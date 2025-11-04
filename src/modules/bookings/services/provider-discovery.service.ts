import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Listing, ListingDocument } from '../../services/listings/listings.schema';
import { metersToKm, calculateDistance } from '../../../common/utils/geo.utils';

export interface ProviderCandidate {
    providerId: string;
    distanceMeters: number;
    listing: any;
    providerName: string;
}

export interface FindCandidatesParams {
    coordinates: [lon: number, lat: number];
    radiusMeters: number;
    categoryId: string;
    subCategoryId?: string;
    excludeProviderIds?: string[];
}

/**
 * ProviderDiscoveryService handles geographic and category-based provider discovery
 * Consolidates geo queries and provider filtering logic
 */
@Injectable()
export class ProviderDiscoveryService {
    private readonly logger = new Logger(ProviderDiscoveryService.name);

    constructor(
        @InjectModel(Listing.name)
        private readonly listingModel: Model<ListingDocument>
    ) {}

    /**
     * Find provider candidates within a geographic radius matching category criteria
     * @param params - Search parameters including coordinates, radius, and category filters
     * @returns Array of provider candidates sorted by distance (nearest first)
     */
    async findCandidates(params: FindCandidatesParams): Promise<ProviderCandidate[]> {
        const { coordinates, radiusMeters, categoryId, subCategoryId, excludeProviderIds = [] } = params;

        this.logger.debug(`Finding candidates: radius=${radiusMeters}m, category=${categoryId}, subcategory=${subCategoryId || 'any'}`);

        // Build aggregation pipeline for geo search
        const pipeline: any[] = [
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: coordinates,
                    },
                    distanceField: 'distance',
                    maxDistance: radiusMeters,
                    spherical: true,
                    key: 'location',
                },
            },
            {
                $match: {
                    isActive: true,
                    categoryId: new Types.ObjectId(categoryId),
                    ...(subCategoryId && { subCategoryId: new Types.ObjectId(subCategoryId) }),
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'providerId',
                    foreignField: '_id',
                    as: 'provider',
                },
            },
            {
                $unwind: {
                    path: '$provider',
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $match: {
                    'provider.isVerified': true,
                    'provider.kycStatus': 'approved',
                },
            },
            {
                $sort: { distance: 1 },
            },
        ];

        const results = await this.listingModel.aggregate(pipeline).exec();

        // Filter and transform results
        const providerMap = new Map<string, ProviderCandidate>();
        const excludeSet = new Set(excludeProviderIds);

        for (const result of results) {
            const providerId = result.providerId?.toString() || result.provider?._id?.toString();

            if (!providerId || excludeSet.has(providerId)) {
                continue; // Skip excluded providers
            }

            // Take only the first (closest) listing per provider
            if (!providerMap.has(providerId)) {
                providerMap.set(providerId, {
                    providerId,
                    distanceMeters: Math.round(result.distance),
                    listing: this.cleanListing(result),
                    providerName: result.provider?.name || 'Provider',
                });
            }
        }

        const candidates = Array.from(providerMap.values());

        this.logger.debug(`Found ${candidates.length} unique providers within ${radiusMeters}m`);

        return candidates;
    }

    /**
     * Clean up listing object for response
     */
    private cleanListing(result: any): any {
        const { provider, distance, ...listing } = result;
        return {
            ...listing,
            providerId: provider?._id,
            providerName: provider?.name,
            distanceMeters: Math.round(distance),
        };
    }

    /**
     * Alternative method using ListingsService pattern (for backward compatibility)
     * This can be deprecated once all code uses findCandidates
     */
    async findProvidersInRadius(
        coordinates: [number, number],
        radiusMeters: number,
        categoryId: string,
        subCategoryId?: string,
        excludeProviders: Types.ObjectId[] = []
    ): Promise<any[]> {
        const params: FindCandidatesParams = {
            coordinates,
            radiusMeters,
            categoryId,
            subCategoryId,
            excludeProviderIds: excludeProviders.map((id) => id.toString()),
        };

        const candidates = await this.findCandidates(params);

        // Transform to match old format
        return candidates.map((candidate) => ({
            _id: new Types.ObjectId(candidate.providerId),
            listing: candidate.listing,
            distance: candidate.distanceMeters,
            providerName: candidate.providerName,
        }));
    }
}
