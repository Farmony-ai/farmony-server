// scripts/fix-provider-ids.ts
// Run this script once to convert string providerIds to ObjectIds in existing listings

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Listing, ListingDocument } from '../modules/marketplace/listings/schemas/listings.schema';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);

    try {
        // Get the Listing model directly from Mongoose
        const listingModel = app.get<Model<ListingDocument>>('ListingModel');

        console.log('Starting migration: Converting string providerIds to ObjectIds...');

        // Find all listings
        const allListings = await listingModel.find({}).exec();
        console.log(`Found ${allListings.length} total listings`);

        let fixedCount = 0;
        let alreadyCorrectCount = 0;
        let errorCount = 0;

        for (const listing of allListings) {
            try {
                const currentProviderId = listing.providerId;

                // Check if providerId is a string (not already an ObjectId)
                if (typeof currentProviderId === 'string') {
                    if (Types.ObjectId.isValid(currentProviderId)) {
                        // Convert string to ObjectId using updateOne to bypass Mongoose casting
                        await listingModel.updateOne(
                            { _id: listing._id },
                            { $set: { providerId: new Types.ObjectId(currentProviderId) } }
                        );
                        fixedCount++;
                        console.log(`Fixed listing ${listing._id}: providerId converted from string to ObjectId`);
                    } else {
                        console.warn(`Listing ${listing._id} has invalid providerId: ${currentProviderId}`);
                        errorCount++;
                    }
                } else if (currentProviderId instanceof Types.ObjectId) {
                    alreadyCorrectCount++;
                } else {
                    // Check if it's an object with _id (populated) or already ObjectId-like
                    const providerIdStr = (currentProviderId as any)?.toString?.();
                    if (providerIdStr && Types.ObjectId.isValid(providerIdStr)) {
                        alreadyCorrectCount++;
                    } else {
                        console.warn(`Listing ${listing._id} has unexpected providerId type: ${typeof currentProviderId}`);
                        errorCount++;
                    }
                }
            } catch (err) {
                console.error(`Error processing listing ${listing._id}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n========== Migration Complete ==========');
        console.log(`Total listings processed: ${allListings.length}`);
        console.log(`Fixed (string -> ObjectId): ${fixedCount}`);
        console.log(`Already correct: ${alreadyCorrectCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('=========================================\n');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await app.close();
    }
}

bootstrap();
