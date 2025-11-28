import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { ListingsService } from './modules/marketplace/listings/services/listings.service';
import { GeoService } from './modules/common/geo/geo.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const connection = app.get(getConnectionToken());
    const listingsService = app.get(ListingsService);
    const geoService = app.get(GeoService);

    console.log('--- DEBUGGING MATCHING LOGIC ---');
    const providerId = "691811021f81ad547ff5ac89";
    const requestId = "7ddabbae-4814-4dbc-947f-013a2ab1b44f";

    // 1. Get Provider Location
    let providerCoords = null;
    const defaultAddress = await geoService.getDefaultAddress(providerId);
    if (defaultAddress?.location?.coordinates) {
        providerCoords = defaultAddress.location.coordinates;
        console.log('Provider Location:', providerCoords);
    } else {
        console.log('Provider has NO default address/location');
    }

    // 2. Get Request
    const request = await connection.collection('servicerequests').findOne({ _id: requestId });
    if (!request) {
        console.log('Request NOT found');
        return;
    }
    console.log('Request Location:', request.location.coordinates);
    console.log('Request Status:', request.status);
    console.log('Request Category:', request.categoryId);
    console.log('Request SubCategory:', request.subCategoryId);

    // 3. Calculate Distance
    if (providerCoords && request.location.coordinates) {
        const R = 6371e3; // metres
        const φ1 = (providerCoords[1] * Math.PI) / 180;
        const φ2 = (request.location.coordinates[1] * Math.PI) / 180;
        const Δφ = ((request.location.coordinates[1] - providerCoords[1]) * Math.PI) / 180;
        const Δλ = ((request.location.coordinates[0] - providerCoords[0]) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        console.log(`Distance: ${distance.toFixed(2)} meters (${(distance / 1000).toFixed(2)} km)`);
        console.log(`Within 40km? ${distance <= 40000}`);
    }

    // 4. Check Categories
    const listings = await listingsService.findByProvider(providerId);
    const activeListings = listings.filter((l: any) => l.isActive);
    console.log(`Active Listings: ${activeListings.length}`);

    const providerCategories = new Set(activeListings.map((l: any) => l.categoryId?._id?.toString() || l.categoryId?.toString()));
    const providerSubCategories = new Set(activeListings.map((l: any) => l.subCategoryId?._id?.toString() || l.subCategoryId?.toString()));

    const reqCatId = request.categoryId?._id?.toString() || request.categoryId?.toString();
    const reqSubCatId = request.subCategoryId?._id?.toString() || request.subCategoryId?.toString();

    console.log(`Provider Categories:`, Array.from(providerCategories));
    console.log(`Provider SubCategories:`, Array.from(providerSubCategories));

    console.log(`Category Match? ${providerCategories.has(reqCatId)}`);
    console.log(`SubCategory Match? ${!reqSubCatId || providerSubCategories.has(reqSubCatId)}`);

    await app.close();
    process.exit(0);
}

bootstrap();
