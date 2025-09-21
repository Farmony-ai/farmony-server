// src/modules/listings/listings.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Listing, ListingDocument } from './listings.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { S3Service } from '../aws/s3.service';
import { UsersService } from '../users/users.service';
import { AddressesService } from '../addresses/addresses.service';
import { Catalogue, CatalogueDocument } from '../catalogue/catalogue.schema';

export interface SearchFilters {
  categoryId?: string;
  subCategoryId?: string;
  priceMin?: number | string;
  priceMax?: number | string;
  distance?: number | string;
  coordinates?: number[] | string;
  searchText?: string;
  isActive?: boolean | string;
  providerId?: string;
  excludeProviderId?: string;
  tags?: string | string[];
  date?: string;
  latitude?: number | string;
  longitude?: number | string;
  radius?: number | string;
  text?: string;
}

@Injectable()
export class ListingsService {
  constructor(
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    @InjectModel(Catalogue.name) private catalogueModel: Model<CatalogueDocument>,
    private readonly s3Service: S3Service,
    private readonly usersService: UsersService,
    private readonly addressesService: AddressesService, 
  ) {}

  async create(dto: CreateListingDto, files: Array<Express.Multer.File> = []): Promise<any> {
  // Validate providerId
  if (!dto.providerId || !Types.ObjectId.isValid(dto.providerId)) {
    throw new BadRequestException('Invalid provider ID');
  }

  // Upload files and get S3 keys
  const photoKeys = files && files.length > 0 
    ? await Promise.all(
        files.map(file => this.s3Service.uploadFile(file, 'listings'))
      )
    : [];
  
  console.log('Photo keys:', photoKeys);

  // Handle location data
  let locationData;
  
  // Check if coordinates are provided and valid (must have exactly 2 values)
  const hasValidCoordinates = (coords: any): boolean => {
    return Array.isArray(coords) && 
           coords.length === 2 && 
           typeof coords[0] === 'number' && 
           typeof coords[1] === 'number' &&
           !isNaN(coords[0]) && 
           !isNaN(coords[1]);
  };

  // Check dto.location.coordinates first
  if (dto.location && hasValidCoordinates(dto.location.coordinates)) {
    locationData = {
      type: 'Point',
      coordinates: dto.location.coordinates
    };
  } 
  // Check dto.coordinates
  else if (hasValidCoordinates((dto as any).coordinates)) {
    locationData = {
      type: 'Point',
      coordinates: (dto as any).coordinates
    };
  } 
  // No valid coordinates provided, fetch from user's default address
  else {
    console.log('No valid coordinates provided, fetching user default address...');
    
    const user = await this.usersService.getUserWithAddress(dto.providerId);
    
    if (user.defaultAddressId && hasValidCoordinates(user.defaultAddressId.coordinates)) {
      console.log('Using user default address coordinates:', user.defaultAddressId.coordinates);
      locationData = {
        type: 'Point',
        coordinates: user.defaultAddressId.coordinates
      };
    } else {
      // Try to get first address from user's addresses
      const userAddresses = await this.addressesService.findAllByUser(dto.providerId);
      
      const validAddress = userAddresses.find(addr => hasValidCoordinates(addr.coordinates));
      
      if (validAddress) {
        console.log('Using user address coordinates:', validAddress.coordinates);
        locationData = {
          type: 'Point',
          coordinates: validAddress.coordinates
        };
      } else {
        throw new BadRequestException(
          'No valid address found for user. Please add an address with valid coordinates to your profile first.'
        );
      }
    }
  }

  // Validate final location data before saving
  if (!locationData || !hasValidCoordinates(locationData.coordinates)) {
    throw new BadRequestException('Unable to determine valid location coordinates for the listing');
  }

  const listing = new this.listingModel({
    ...dto,
    photos: photoKeys,
    location: locationData
  });
  
  const saved = await listing.save();
  
  // Return with public URLs (no async needed!)
  return this.transformWithPublicUrls(saved);
}

  async findAll(filters?: SearchFilters): Promise<any[]> {
    try {
      console.log('ListingsService.findAll - Raw filters:', filters);
      
      const parsedFilters = this.parseSearchFilters(filters);
      console.log('ListingsService.findAll - Parsed filters:', parsedFilters);
      
      // Search for category/subcategory match
      if (parsedFilters.searchText && parsedFilters.searchText.trim() && 
          !parsedFilters.categoryId && !parsedFilters.subCategoryId) {
        
        const searchTerm = parsedFilters.searchText.trim();
        console.log('Searching for category/subcategory match for:', searchTerm);
        
        const categoryMatch = await this.catalogueModel.findOne({
          name: new RegExp(`^${searchTerm}$`, 'i'),
          parentId: null
        } as any).exec();
        
        if (categoryMatch) {
          console.log('Found matching category:', categoryMatch.name);
          parsedFilters.categoryId = categoryMatch._id.toString();
          delete parsedFilters.searchText;
        } else {
          const subCategoryMatch = await this.catalogueModel.findOne({
            name: new RegExp(`^${searchTerm}$`, 'i'),
            parentId: { $ne: null }
          } as any).exec();
          
          if (subCategoryMatch) {
            console.log('Found matching subcategory:', subCategoryMatch.name);
            parsedFilters.subCategoryId = subCategoryMatch._id.toString();
            delete parsedFilters.searchText;
          }
        }
      }
      
      const needsDistanceSort = parsedFilters.coordinates && parsedFilters.distance;
      
      let listings;
      
      if (needsDistanceSort) {
        // Aggregation pipeline for distance-based search
        const pipeline: any[] = [];
        
        const geoQuery: any = { 
          isActive: parsedFilters.isActive ?? true,
          // Add validation to ensure providerId exists and is valid
          providerId: { $exists: true, $nin: [null, ''] }
        };
        
        if (parsedFilters.categoryId) {
          geoQuery.categoryId = new Types.ObjectId(parsedFilters.categoryId);
        }
        
        if (parsedFilters.subCategoryId) {
          geoQuery.subCategoryId = new Types.ObjectId(parsedFilters.subCategoryId);
        }
        
        if (parsedFilters.excludeProviderId && Types.ObjectId.isValid(parsedFilters.excludeProviderId)) {
          geoQuery.providerId.$ne = new Types.ObjectId(parsedFilters.excludeProviderId);
        }
        
        if (parsedFilters.searchText && parsedFilters.searchText.trim()) {
          const searchRegex = new RegExp(parsedFilters.searchText.trim(), 'i');
          geoQuery.description = searchRegex;
        }
        
        pipeline.push({
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: parsedFilters.coordinates
            },
            distanceField: 'distance',
            maxDistance: parsedFilters.distance * 1000,
            spherical: true,
            query: geoQuery
          }
        });
        
        // Add lookups with proper error handling
        pipeline.push(
          {
            $lookup: {
              from: 'catalogues',
              localField: 'categoryId',
              foreignField: '_id',
              as: 'categoryId'
            }
          },
          {
            $unwind: {
              path: '$categoryId',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $lookup: {
              from: 'catalogues',
              localField: 'subCategoryId',
              foreignField: '_id',
              as: 'subCategoryId'
            }
          },
          {
            $unwind: {
              path: '$subCategoryId',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $lookup: {
              from: 'users',
              let: { providerId: '$providerId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $ne: ['$$providerId', null] },
                        { $ne: ['$$providerId', ''] },
                        { $eq: ['$_id', '$$providerId'] }
                      ]
                    }
                  }
                }
              ],
              as: 'providerId'
            }
          },
          {
            $unwind: {
              path: '$providerId',
              preserveNullAndEmptyArrays: true
            }
          }
        );
        
        pipeline.push({
          $sort: { distance: 1 }
        });
        
        listings = await this.listingModel.aggregate(pipeline).exec();
        
      } else {
        // Regular query
        const query: any = { 
          isActive: parsedFilters.isActive ?? true,
          // Add validation to ensure providerId exists and is valid
          providerId: { $exists: true, $nin: [null, ''] }
        };
        
        if (parsedFilters.categoryId) {
          query.categoryId = parsedFilters.categoryId;
        }
        
        if (parsedFilters.subCategoryId) {
          query.subCategoryId = parsedFilters.subCategoryId;
        }
        
        if (parsedFilters.excludeProviderId && Types.ObjectId.isValid(parsedFilters.excludeProviderId)) {
          query.providerId.$ne = parsedFilters.excludeProviderId;
        }
        
        if (parsedFilters.searchText && parsedFilters.searchText.trim()) {
          const searchRegex = new RegExp(parsedFilters.searchText.trim(), 'i');
          query.description = searchRegex;
        }
        
        // First get the listings without population
        const rawListings = await this.listingModel.find(query)
          .sort({ createdAt: -1 })
          .exec();
        
        // Then populate only valid references
        listings = await Promise.all(
          rawListings.map(async (listing) => {
            try {
              // Only populate if IDs are valid
              let populatedListing = listing;
              
              if (listing.providerId && Types.ObjectId.isValid(listing.providerId.toString())) {
                populatedListing = await listing.populate('providerId', 'name phone');
              }
              
              if (listing.categoryId && Types.ObjectId.isValid(listing.categoryId.toString())) {
                populatedListing = await populatedListing.populate('categoryId', 'name');
              }
              
              if (listing.subCategoryId && Types.ObjectId.isValid(listing.subCategoryId.toString())) {
                populatedListing = await populatedListing.populate('subCategoryId', 'name');
              }
              
              return populatedListing;
            } catch (err) {
              console.warn(`Warning: Could not populate listing ${listing._id}:`, err.message);
              return listing; // Return unpopulated listing if population fails
            }
          })
        );
      }
      
      // Transform all listings with public URLs
      return listings.map(listing => this.transformWithPublicUrls(listing));
      
    } catch (error) {
      console.error('ListingsService.findAll - Error:', error);
      throw new BadRequestException(`Failed to search listings: ${error.message}`);
    }
  }

  async findNearby(coordinates: number[], maxDistance: number, excludeProviderId?: string): Promise<any[]> {
    const query: any = {
      isActive: true,
      providerId: { $exists: true, $nin: [null, ''] }, // Add validation
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates
          },
          $maxDistance: maxDistance * 1000
        }
      }
    };

    if (excludeProviderId && Types.ObjectId.isValid(excludeProviderId)) {
      query.providerId.$ne = excludeProviderId;
    }

    const listings = await this.listingModel.find(query)
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('providerId', 'name phone')
      .exec();

    return listings.map(listing => this.transformWithPublicUrls(listing));
  }

  async findByProvider(providerId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw new BadRequestException('Invalid provider ID');
    }

    const listings = await this.listingModel
      .find({ providerId })
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .sort({ createdAt: -1 })
      .exec();
    
    return listings.map(listing => this.transformWithPublicUrls(listing));
  }

  async findById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid listing ID');
    }

    const listing = await this.listingModel
      .findByIdAndUpdate(
        id,
        { $inc: { viewCount: 1 } },
        { new: true }
      )
      .populate('categoryId')
      .populate('subCategoryId')
      .populate('providerId')
      .exec();
      
    if (!listing) throw new NotFoundException('Listing not found');
    
    return this.transformWithPublicUrls(listing);
  }

  async update(id: string, dto: UpdateListingDto): Promise<any> {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException('Invalid listing ID');
  }

  // Helper function to validate coordinates
  const hasValidCoordinates = (coords: any): boolean => {
    return Array.isArray(coords) && 
           coords.length === 2 && 
           typeof coords[0] === 'number' && 
           typeof coords[1] === 'number' &&
           !isNaN(coords[0]) && 
           !isNaN(coords[1]);
  };

  const updateData: any = { ...dto };
  
  // Only update location if valid coordinates are provided
  if (dto.location && hasValidCoordinates(dto.location.coordinates)) {
    updateData.location = {
      type: 'Point',
      coordinates: dto.location.coordinates
    };
  } else if (hasValidCoordinates((dto as any).coordinates)) {
    updateData.location = {
      type: 'Point',
      coordinates: (dto as any).coordinates
    };
    delete updateData.coordinates;
  } else if (dto.location || (dto as any).coordinates) {
    // If location update was attempted but coordinates are invalid, remove it
    delete updateData.location;
    delete updateData.coordinates;
    console.warn('Invalid coordinates provided for update, skipping location update');
  }

  const updated = await this.listingModel
    .findByIdAndUpdate(id, updateData, { new: true })
    .populate('categoryId')
    .populate('subCategoryId')
    .populate('providerId')
    .exec();
    
  if (!updated) throw new NotFoundException('Listing not found');
  
  return this.transformWithPublicUrls(updated);
}

  async delete(id: string): Promise<Listing> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid listing ID');
    }

    const listing = await this.listingModel.findById(id).exec();
    if (!listing) throw new NotFoundException('Listing not found');
    
    // Delete images from S3
    if (listing.photos && listing.photos.length > 0) {
      await this.s3Service.deleteFiles(listing.photos);
    }
    
    const removed = await this.listingModel.findByIdAndDelete(id).exec();
    return removed;
  }

  async incrementBookingCount(listingId: string): Promise<void> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new BadRequestException('Invalid listing ID');
    }

    await this.listingModel.findByIdAndUpdate(
      listingId,
      { $inc: { bookingCount: 1 } }
    );
  }

  /**
   * Transform listing with public URLs (NOT async anymore!)
   * This is now a synchronous operation since we're not generating presigned URLs
   */
  private transformWithPublicUrls(listing: ListingDocument | any): any {
    const listingObj = typeof listing.toObject === 'function' ? listing.toObject() : listing;
    
    // Generate public URLs for all photos (synchronous!)
    if (listing.photos && listing.photos.length > 0) {
      listingObj.photoUrls = this.s3Service.getPublicUrls(listing.photos);
    } else {
      listingObj.photoUrls = [];
    }
    
    // Optionally keep the S3 keys (useful for delete operations)
    // delete listingObj.photos;
    
    return listingObj;
  }

  async toggleListingStatus(id: string, isActive: boolean): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid listing ID');
    }

    const updated = await this.listingModel
      .findByIdAndUpdate(id, { isActive }, { new: true })
      .populate('categoryId')
      .populate('subCategoryId')
      .populate('providerId')
      .exec();
      
    if (!updated) throw new NotFoundException('Listing not found');
    
    return this.transformWithPublicUrls(updated);
  }

  // Helper method to parse search filters
  private parseSearchFilters(filters: any): any {
    const parsed: any = {};
    
    if (filters?.isActive !== undefined) {
      parsed.isActive = filters.isActive === 'true' || filters.isActive === true;
    }
    
    if (filters?.priceMin !== undefined && filters.priceMin !== 'undefined' && filters.priceMin !== '') {
      const priceMin = parseFloat(filters.priceMin);
      parsed.priceMin = isNaN(priceMin) ? null : priceMin;
    } else {
      parsed.priceMin = null;
    }
    
    if (filters?.priceMax !== undefined && filters.priceMax !== 'undefined' && filters.priceMax !== '') {
      const priceMax = parseFloat(filters.priceMax);
      parsed.priceMax = isNaN(priceMax) ? null : priceMax;
    } else {
      parsed.priceMax = null;
    }
    
    if (filters?.coordinates) {
      if (typeof filters.coordinates === 'string') {
        try {
          parsed.coordinates = JSON.parse(filters.coordinates);
        } catch (e) {
          const coords = filters.coordinates.split(',').map(c => parseFloat(c.trim()));
          if (coords.length === 2 && !coords.some(isNaN)) {
            parsed.coordinates = coords;
          }
        }
      } else if (Array.isArray(filters.coordinates)) {
        parsed.coordinates = filters.coordinates.map(c => parseFloat(c));
      }
    } else if (filters?.latitude && filters?.longitude) {
      const lat = parseFloat(filters.latitude);
      const lng = parseFloat(filters.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        parsed.coordinates = [lng, lat];
      }
    }
    
    if (filters?.distance !== undefined && filters.distance !== 'undefined' && filters.distance !== '') {
      const distance = parseFloat(filters.distance);
      parsed.distance = isNaN(distance) ? null : distance;
    } else if (filters?.radius !== undefined && filters.radius !== 'undefined' && filters.radius !== '') {
      const radius = parseFloat(filters.radius);
      parsed.distance = isNaN(radius) ? null : radius;
    }
    
    if (filters?.searchText && filters.searchText !== 'undefined') {
      parsed.searchText = filters.searchText;
    } else if (filters?.text && filters.text !== 'undefined') {
      parsed.searchText = filters.text;
    }
    
    if (filters?.categoryId && filters.categoryId !== 'undefined') {
      parsed.categoryId = filters.categoryId;
    }
    
    if (filters?.subCategoryId && filters.subCategoryId !== 'undefined') {
      parsed.subCategoryId = filters.subCategoryId;
    }
    
    if (filters?.providerId && filters.providerId !== 'undefined') {
      parsed.providerId = filters.providerId;
    }
    
    if (filters?.excludeProviderId && filters.excludeProviderId !== 'undefined' && filters.excludeProviderId !== '') {
      parsed.excludeProviderId = filters.excludeProviderId;
    }
    
    if (filters?.tags) {
      if (typeof filters.tags === 'string') {
        parsed.tags = [filters.tags];
      } else if (Array.isArray(filters.tags)) {
        parsed.tags = filters.tags;
      }
    }
    
    return parsed;
  }

  // Smart search method
  async smartSearch(searchText: string, otherFilters?: Partial<SearchFilters>): Promise<{
    listings: any[];
    searchType: 'category' | 'subcategory' | 'description';
    matchedTerm?: string;
  }> {
    const searchTerm = searchText.trim();
    let searchType: 'category' | 'subcategory' | 'description' = 'description';
    let matchedTerm: string | undefined;
    
    const categoryMatch = await this.catalogueModel.findOne({
      name: new RegExp(`^${searchTerm}$`, 'i'),
      parentId: null
    } as any).exec();
    
    if (categoryMatch) {
      searchType = 'category';
      matchedTerm = categoryMatch.name;
      const filters = {
        ...otherFilters,
        categoryId: categoryMatch._id.toString()
      };
      const listings = await this.findAll(filters);
      return { listings, searchType, matchedTerm };
    }
    
    const subCategoryMatch = await this.catalogueModel.findOne({
      name: new RegExp(`^${searchTerm}$`, 'i'),
      parentId: { $ne: null }
    } as any).exec();
    
    if (subCategoryMatch) {
      searchType = 'subcategory';
      matchedTerm = subCategoryMatch.name;
      const filters = {
        ...otherFilters,
        subCategoryId: subCategoryMatch._id.toString()
      };
      const listings = await this.findAll(filters);
      return { listings, searchType, matchedTerm };
    }
    
    const filters = {
      ...otherFilters,
      searchText: searchTerm
    };
    const listings = await this.findAll(filters);
    return { listings, searchType };
  }

  // Add a method to clean up invalid listings (run this once to fix existing data)
  async cleanupInvalidListings(): Promise<{ cleaned: number }> {
    const result = await this.listingModel.deleteMany({
      $or: [
        { providerId: null },
        { providerId: '' },
        { providerId: { $exists: false } }
      ]
    });
    
    console.log(`Cleaned up ${result.deletedCount} listings with invalid providerIds`);
    return { cleaned: result.deletedCount };
  }

  // DEPRECATED - This method is no longer needed!
  async refreshUrls(listingId: string): Promise<{ photoUrls: string[] }> {
    console.warn('⚠️  refreshUrls() is deprecated. URLs no longer expire with CloudFront.');
    
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) throw new NotFoundException('Listing not found');
    
    return { 
      photoUrls: this.s3Service.getPublicUrls(listing.photos)
    };
  }

  /**
 * Validates if coordinates are in the correct format for MongoDB geospatial Point
 * @param coords - The coordinates to validate
 * @returns true if coordinates are valid [longitude, latitude] format
 */
private hasValidCoordinates(coords: any): boolean {
  return Array.isArray(coords) && 
         coords.length === 2 && 
         typeof coords[0] === 'number' && 
         typeof coords[1] === 'number' &&
         !isNaN(coords[0]) && 
         !isNaN(coords[1]) &&
         coords[0] >= -180 && coords[0] <= 180 && // Valid longitude range
         coords[1] >= -90 && coords[1] <= 90;     // Valid latitude range
}
}