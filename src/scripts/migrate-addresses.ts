// scripts/migrate-addresses.ts
// Run this script to migrate existing listings and service requests to use addresses

import { connect, model } from 'mongoose';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { ListingSchema } from '../modules/listings/listings.schema';
import { AddressSchema } from '../modules/addresses/addresses.schema';
import { UserSchema } from '../modules/users/users.schema';
import { ServiceRequestSchema } from '../modules/service-requests/entities/service-request.entity';
import { AddressType } from '../common/interfaces/address.interface';

const Listing = model('Listing', ListingSchema);
const Address = model('Address', AddressSchema);
const User = model('User', UserSchema);
const ServiceRequest = model('ServiceRequest', ServiceRequestSchema);

const NEAR_DISTANCE_METERS = 25;

function isValidCoordinates(value: any): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    !Number.isNaN(value[0]) &&
    !Number.isNaN(value[1])
  );
}

function buildGeoPoint(coordinates: [number, number]) {
  return {
    type: 'Point',
    coordinates,
  };
}

async function ensureAddressGeo(address: any, coordinates: [number, number]) {
  let changed = false;

  if (!address.location || !isValidCoordinates(address.location.coordinates)) {
    address.location = buildGeoPoint(coordinates);
    changed = true;
  }

  if (!isValidCoordinates(address.coordinates)) {
    address.coordinates = coordinates;
    changed = true;
  }

  if (changed) {
    await address.save();
  }
}

async function findExistingAddress(
  userId: any,
  coordinates: [number, number],
): Promise<any | null> {
  try {
    const geoMatch = await Address.findOne({
      userId,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: NEAR_DISTANCE_METERS,
        },
      },
    });

    if (geoMatch) {
      await ensureAddressGeo(geoMatch, coordinates);
      return geoMatch;
    }
  } catch (error) {
    console.warn(`Geo lookup failed for user ${userId}: ${(error as Error).message}`);
  }

  const legacyMatch = await Address.findOne({ userId, coordinates });
  if (legacyMatch) {
    await ensureAddressGeo(legacyMatch, coordinates);
    return legacyMatch;
  }

  return null;
}

async function migrateAddresses() {
  const env = process.env.NODE_ENV || 'dev';
  const envPath = path.resolve(__dirname, '..', '..', `.env.${env}`);
  loadEnv({ path: envPath });

  const mongoUri =
    env === 'prod' ? process.env.MONGO_URI_PROD : process.env.MONGO_URI_DEV;

  if (!mongoUri) {
    throw new Error(`Mongo URI not set. Expected ${env === 'prod' ? 'MONGO_URI_PROD' : 'MONGO_URI_DEV'} in ${envPath}`);
  }

  // Connect to MongoDB
  console.log(`Connecting to MongoDB (${env})...`);
  await connect(mongoUri);
  
  console.log('Connected. Starting address migration...');
  
  // 1. Migrate Listings
  console.log('\n=== Migrating Listings ===');
  const listings = await Listing.find({ 
    serviceAddressId: { $exists: false },
    location: { $exists: true }
  });
  
  console.log(`Found ${listings.length} listings without address references`);
  
  for (const listing of listings) {
    try {
      // Check if listing has valid coordinates
      const coordinates = listing.location?.coordinates;
      if (!isValidCoordinates(coordinates)) {
        console.warn(`Skipping listing ${listing._id} - invalid coordinates`);
        continue;
      }
      
      // Check if address already exists at these coordinates for this provider
      let address = await findExistingAddress(listing.providerId, coordinates);
      
      if (!address) {
        // Create new address for this listing location
        address = new Address({
          userId: listing.providerId,
          addressType: AddressType.SERVICE_AREA,
          addressLine1: `Listing Location - ${listing.title || 'Service'}`,
          village: 'Update Required',
          district: 'Update Required', 
          state: 'Update Required',
          pincode: '000000',
          location: buildGeoPoint(coordinates),
          coordinates,
          isDefault: false
        });
        
        await address.save();
        console.log(`Created address ${address._id} for listing ${listing._id}`);
      }
      
      await ensureAddressGeo(address, coordinates);

      // Update listing with address reference
      listing.serviceAddressId = address._id;
      await listing.save();
      console.log(`Updated listing ${listing._id} with address ${address._id}`);
      
    } catch (error) {
      console.error(`Error migrating listing ${listing._id}:`, error);
    }
  }
  
  // 2. Migrate Service Requests
  console.log('\n=== Migrating Service Requests ===');
  const serviceRequests = await ServiceRequest.find({
    serviceAddressId: { $exists: false },
    location: { $exists: true }
  });
  
  console.log(`Found ${serviceRequests.length} service requests without address references`);
  
  for (const request of serviceRequests) {
    try {
      // Check if request has valid coordinates
      const coordinates = request.location?.coordinates;
      if (!isValidCoordinates(coordinates)) {
        console.warn(`Skipping service request ${request._id} - invalid coordinates`);
        continue;
      }
      
      // Check if address already exists at these coordinates for this seeker
      let address = await findExistingAddress(request.seekerId, coordinates);
      
      if (!address) {
        // Create new address for this service location
        address = new Address({
          userId: request.seekerId,
          addressType: AddressType.SERVICE_AREA,
          addressLine1: request.address || `Service Request - ${request.title}`,
          village: 'Update Required',
          district: 'Update Required',
          state: 'Update Required',
          pincode: '000000',
          location: buildGeoPoint(coordinates),
          coordinates,
          isDefault: false
        });
        
        await address.save();
        console.log(`Created address ${address._id} for service request ${request._id}`);
      }
      
      await ensureAddressGeo(address, coordinates);

      // Update service request with address reference
      request.serviceAddressId = address._id;
      await request.save();
      console.log(`Updated service request ${request._id} with address ${address._id}`);
      
    } catch (error) {
      console.error(`Error migrating service request ${request._id}:`, error);
    }
  }
  
  // 3. Create default addresses for users without any
  console.log('\n=== Creating Default Addresses for Users ===');
  const usersWithoutAddresses = await User.aggregate([
    {
      $lookup: {
        from: 'addresses',
        localField: '_id',
        foreignField: 'userId',
        as: 'addresses'
      }
    },
    {
      $match: {
        addresses: { $size: 0 }
      }
    }
  ]);
  
  console.log(`Found ${usersWithoutAddresses.length} users without addresses`);
  
  for (const user of usersWithoutAddresses) {
    try {
      const fallbackCoordinates: [number, number] = isValidCoordinates(user.coordinates)
        ? user.coordinates
        : [77.2090, 28.6139];

      const address = new Address({
        userId: user._id,
        addressType: AddressType.HOME,
        addressLine1: 'Please Update',
        village: 'Please Update',
        district: 'Please Update',
        state: 'Please Update',
        pincode: '000000',
        location: buildGeoPoint(fallbackCoordinates),
        coordinates: fallbackCoordinates, // Default to Delhi if no coordinates
        isDefault: true
      });
      
      await address.save();
      
      // Update user with default address
      await User.findByIdAndUpdate(user._id, {
        defaultAddressId: address._id
      });
      
      console.log(`Created default address ${address._id} for user ${user.name} (${user._id})`);
      
    } catch (error) {
      console.error(`Error creating address for user ${user._id}:`, error);
    }
  }
  
  // 4. Remove duplicate coordinates from User schema
  console.log('\n=== Cleaning Up User Coordinates ===');
  const usersWithCoordinates = await User.find({ 
    coordinates: { $exists: true } 
  });
  
  console.log(`Found ${usersWithCoordinates.length} users with coordinates field`);
  
  for (const user of usersWithCoordinates) {
    try {
      // Check if user has default address
      if (user.defaultAddressId) {
        const address = await Address.findById(user.defaultAddressId);
        if (address && isValidCoordinates(user.coordinates)) {
          await ensureAddressGeo(address, user.coordinates as [number, number]);
          console.log(`Updated address ${address._id} with coordinates from user ${user._id}`);
        }
      } else if (isValidCoordinates(user.coordinates)) {
        // Create default address with these coordinates
        const coordinates = user.coordinates as [number, number];
        const address = new Address({
          userId: user._id,
          addressType: AddressType.HOME,
          addressLine1: 'Migrated from User',
          village: 'Please Update',
          district: 'Please Update',
          state: 'Please Update',
          pincode: '000000',
          location: buildGeoPoint(coordinates),
          coordinates,
          isDefault: true
        });

        await address.save();
        user.defaultAddressId = address._id;
        await user.save();
        console.log(`Created address ${address._id} from user ${user._id} coordinates`);
      } else if (user.coordinates) {
        console.log(`Removing invalid coordinates for user ${user._id}`);
      }
      
      if (user.coordinates) {
        await User.findByIdAndUpdate(user._id, {
          $unset: { coordinates: 1 }
        });
      }
      
    } catch (error) {
      console.error(`Error migrating user ${user._id} coordinates:`, error);
    }
  }
  
  // 5. Fix coordinate format issues
  console.log('\n=== Fixing Coordinate Format Issues ===');
  const addressesWithBadCoordinates = await Address.find({
    $or: [
      { coordinates: { $exists: false } },
      { 'coordinates.0': { $type: 'string' } },
      { 'coordinates.1': { $type: 'string' } }
    ]
  });
  
  console.log(`Found ${addressesWithBadCoordinates.length} addresses with coordinate issues`);
  
  for (const address of addressesWithBadCoordinates) {
    try {
      // Try to fix coordinates
      if (address.coordinates && address.coordinates.length === 2) {
        // Convert strings to numbers if needed
        const coord0 = typeof address.coordinates[0] === 'string' 
          ? parseFloat(address.coordinates[0]) 
          : address.coordinates[0];
        const coord1 = typeof address.coordinates[1] === 'string' 
          ? parseFloat(address.coordinates[1]) 
          : address.coordinates[1];
        
        address.coordinates = [coord0, coord1];
        
        if (!isNaN(coord0) && !isNaN(coord1)) {
          await address.save();
          console.log(`Fixed coordinates for address ${address._id}`);
        } else {
          console.warn(`Could not fix coordinates for address ${address._id}`);
        }
      } else {
        console.warn(`Address ${address._id} has invalid coordinates: ${JSON.stringify(address.coordinates)}`);
      }
    } catch (error) {
      console.error(`Error fixing address ${address._id}:`, error);
    }
  }
  
  // 6. Summary
  console.log('\n=== Migration Summary ===');
  const stats = {
    totalListings: await Listing.countDocuments(),
    listingsWithAddress: await Listing.countDocuments({ serviceAddressId: { $exists: true } }),
    totalServiceRequests: await ServiceRequest.countDocuments(),
    serviceRequestsWithAddress: await ServiceRequest.countDocuments({ serviceAddressId: { $exists: true } }),
    totalAddresses: await Address.countDocuments(),
    usersWithDefaultAddress: await User.countDocuments({ defaultAddressId: { $exists: true } })
  };
  
  console.log('Statistics:', stats);
  
  console.log('\nMigration completed!');
  process.exit(0);
}

// Run the migration
migrateAddresses().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});

// ============================================
// package.json script to run migration:
// "scripts": {
//   "migrate:addresses": "ts-node scripts/migrate-addresses.ts"
// }
