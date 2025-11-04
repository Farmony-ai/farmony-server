// scripts/cleanup-invalid-listings.ts
// Run this script once to clean up invalid data in your database

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ListingsService } from '../modules/bookings/services/listings/listings.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);

    try {
        const listingsService = app.get(ListingsService);

        console.log('Starting cleanup of invalid listings...');

        // Clean up listings with invalid providerIds
        const result = await listingsService.cleanupInvalidListings();

        console.log(`✅ Cleanup complete! Removed ${result.cleaned} invalid listings.`);
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await app.close();
    }
}

bootstrap();
