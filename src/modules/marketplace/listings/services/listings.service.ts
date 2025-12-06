// src/modules/marketplace/listings/services/listings.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Listing, ListingDocument } from '../schemas/listings.schema';
import { CreateListingDto } from '../dto/create-listing.dto';
import { UpdateListingDto } from '../dto/update-listing.dto';
import { FirebaseStorageService } from '../../../common/firebase/firebase-storage.service';
import { UsersService } from '../../../identity/services/users.service';
import { GeoService } from '../../../common/geo/geo.service';
import { Catalogue, CatalogueDocument } from '../../catalogue/schemas/catalogue.schema';
import { AddressType } from '../../../identity/schemas/users.schema';

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
        private readonly storageService: FirebaseStorageService,
        @Inject(forwardRef(() => UsersService)) private readonly usersService: UsersService,
        private readonly geoService: GeoService
    ) { }

    async create(dto: CreateListingDto, files: Array<Express.Multer.File> = []): Promise<any> {
        // Validate providerId
        if (!dto.providerId || !Types.ObjectId.isValid(dto.providerId)) {
            throw new BadRequestException('Invalid provider ID');
        }

        // Upload files and get storage keys
        const photoKeys = files && files.length > 0 ? await Promise.all(files.map((file) => this.storageService.uploadFile(file, 'listings'))) : [];

        // IMPROVED: Handle address and location
        let serviceAddressId: string;
        let locationData: any;

        // Option 1: Address ID provided
        if (dto.addressId) {
            const address = await this.geoService.getUserAddress(dto.providerId, dto.addressId);
            if (!address) {
                throw new BadRequestException(`Address ${dto.addressId} not found`);
            }
            serviceAddressId = address._id.toString();
            locationData = {
                type: 'Point',
                coordinates: address.location.coordinates,
            };
        }
        // Option 2: Coordinates provided - create/find address
        else if (dto.location?.coordinates && this.hasValidCoordinates(dto.location.coordinates)) {
            const coordinates = dto.location.coordinates as [number, number];
            const address = await this.geoService.getAddressByCoordinates(dto.providerId, coordinates, {
                addressLine1: dto.addressLine1 || 'Listing Location',
                village: dto.village,
                district: dto.district,
                state: dto.state,
                pincode: dto.pincode,
            });
            serviceAddressId = address._id.toString();
            locationData = {
                type: 'Point',
                coordinates: address.location.coordinates,
            };
        }
        // Option 3: Use provider's default address
        else {
            const address = await this.geoService.getDefaultAddress(dto.providerId);
            if (!address) {
                throw new BadRequestException(`No default address found for provider ${dto.providerId}`);
            }
            serviceAddressId = address._id.toString();
            locationData = {
                type: 'Point',
                coordinates: address.location.coordinates,
            };

            console.log(`Using provider's default address: ${address._id}`);
        }

        const listing = new this.listingModel({
            ...dto,
            providerId: new Types.ObjectId(dto.providerId), // Explicit conversion to ObjectId
            photos: photoKeys,
            location: locationData,
            serviceAddressId: new Types.ObjectId(serviceAddressId), // Link to address
        });

        const saved = await listing.save();

        // Note: serviceAddressId references embedded Address in User.addresses array
        // Cannot populate embedded documents
        return this.transformWithPublicUrls(saved);
    }

    async findAll(filters?: SearchFilters): Promise<any[]> {
        try {
            console.log('ListingsService.findAll - Raw filters:', filters);

            const parsedFilters = this.parseSearchFilters(filters);
            console.log('ListingsService.findAll - Parsed filters:', parsedFilters);

            // Search for category/subcategory match
            if (parsedFilters.searchText && parsedFilters.searchText.trim() && !parsedFilters.categoryId && !parsedFilters.subCategoryId) {
                const searchTerm = parsedFilters.searchText.trim();
                console.log('Searching for category/subcategory match for:', searchTerm);

                const categoryMatch = await this.catalogueModel
                    .findOne({
                        name: new RegExp(`^${searchTerm}$`, 'i'),
                        parentId: null,
                    } as any)
                    .exec();

                if (categoryMatch) {
                    console.log('Found matching category:', categoryMatch.name);
                    parsedFilters.categoryId = categoryMatch._id.toString();
                    delete parsedFilters.searchText;
                } else {
                    const subCategoryMatch = await this.catalogueModel
                        .findOne({
                            name: new RegExp(`^${searchTerm}$`, 'i'),
                            parentId: { $ne: null },
                        } as any)
                        .exec();

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
                    providerId: { $exists: true, $nin: [null, ''] },
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
                            coordinates: parsedFilters.coordinates,
                        },
                        distanceField: 'distance',
                        maxDistance: parsedFilters.distance * 1000,
                        spherical: true,
                        query: geoQuery,
                    },
                });

                // Add lookups with proper error handling
                pipeline.push(
                    {
                        $lookup: {
                            from: 'catalogues',
                            localField: 'categoryId',
                            foreignField: '_id',
                            as: 'categoryId',
                        },
                    },
                    {
                        $unwind: {
                            path: '$categoryId',
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $lookup: {
                            from: 'catalogues',
                            localField: 'subCategoryId',
                            foreignField: '_id',
                            as: 'subCategoryId',
                        },
                    },
                    {
                        $unwind: {
                            path: '$subCategoryId',
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $lookup: {
                            from: 'users',
                            let: { providerId: '$providerId' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [{ $ne: ['$$providerId', null] }, { $ne: ['$$providerId', ''] }, { $eq: ['$_id', '$$providerId'] }],
                                        },
                                    },
                                },
                            ],
                            as: 'providerId',
                        },
                    },
                    {
                        $unwind: {
                            path: '$providerId',
                            preserveNullAndEmptyArrays: true,
                        },
                    }
                );

                pipeline.push({
                    $sort: { distance: 1 },
                });

                listings = await this.listingModel.aggregate(pipeline).exec();
            } else {
                // Regular query
                const query: any = {
                    isActive: parsedFilters.isActive ?? true,
                    // Add validation to ensure providerId exists and is valid
                    providerId: { $exists: true, $nin: [null, ''] },
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
                const rawListings = await this.listingModel.find(query).sort({ createdAt: -1 }).exec();

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
            return listings.map((listing) => this.transformWithPublicUrls(listing));
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
                        coordinates,
                    },
                    $maxDistance: maxDistance * 1000,
                },
            },
        };

        if (excludeProviderId && Types.ObjectId.isValid(excludeProviderId)) {
            query.providerId.$ne = excludeProviderId;
        }

        const listings = await this.listingModel.find(query).populate('categoryId', 'name').populate('subCategoryId', 'name').populate('providerId', 'name phone').exec();

        return listings.map((listing) => this.transformWithPublicUrls(listing));
    }

    async findByProvider(providerId: string): Promise<any[]> {
        if (!Types.ObjectId.isValid(providerId)) {
            throw new BadRequestException('Invalid provider ID');
        }

        const listings = await this.listingModel.find({ providerId: new Types.ObjectId(providerId) }).populate('categoryId', 'name').populate('subCategoryId', 'name').sort({ createdAt: -1 }).exec();

        return listings.map((listing) => this.transformWithPublicUrls(listing));
    }

    async findById(id: string): Promise<any> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid listing ID');
        }

        const listing = await this.listingModel
            .findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { new: true })
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
            return Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number' && !isNaN(coords[0]) && !isNaN(coords[1]);
        };

        const updateData: any = { ...dto };

        // Only update location if valid coordinates are provided
        if (dto.location && hasValidCoordinates(dto.location.coordinates)) {
            updateData.location = {
                type: 'Point',
                coordinates: dto.location.coordinates,
            };
        } else if (hasValidCoordinates((dto as any).coordinates)) {
            updateData.location = {
                type: 'Point',
                coordinates: (dto as any).coordinates,
            };
            delete updateData.coordinates;
        } else if (dto.location || (dto as any).coordinates) {
            // If location update was attempted but coordinates are invalid, remove it
            delete updateData.location;
            delete updateData.coordinates;
            console.warn('Invalid coordinates provided for update, skipping location update');
        }

        const updated = await this.listingModel.findByIdAndUpdate(id, updateData, { new: true }).populate('categoryId').populate('subCategoryId').populate('providerId').exec();

        if (!updated) throw new NotFoundException('Listing not found');

        return this.transformWithPublicUrls(updated);
    }

    async delete(id: string): Promise<Listing> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid listing ID');
        }

        const listing = await this.listingModel.findById(id).exec();
        if (!listing) throw new NotFoundException('Listing not found');

        // Delete images from storage
        if (listing.photos && listing.photos.length > 0) {
            await this.storageService.deleteFiles(listing.photos);
        }

        const removed = await this.listingModel.findByIdAndDelete(id).exec();
        return removed;
    }

    async incrementBookingCount(listingId: string): Promise<void> {
        if (!Types.ObjectId.isValid(listingId)) {
            throw new BadRequestException('Invalid listing ID');
        }

        await this.listingModel.findByIdAndUpdate(listingId, { $inc: { bookingCount: 1 } });
    }

    /**
     * Transform listing with public URLs (NOT async anymore!)
     * This is now a synchronous operation since we're not generating presigned URLs
     */
    private transformWithPublicUrls(listing: ListingDocument | any): any {
        const listingObj = typeof listing.toObject === 'function' ? listing.toObject() : listing;

        // Generate public URLs for all photos (synchronous!)
        if (listing.photos && listing.photos.length > 0) {
            listingObj.photoUrls = this.storageService.getPublicUrls(listing.photos);
        } else {
            listingObj.photoUrls = [];
        }

        // Optionally keep the storage keys (useful for delete operations)
        // delete listingObj.photos;

        return listingObj;
    }

    async toggleListingStatus(id: string, isActive: boolean): Promise<any> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid listing ID');
        }

        const updated = await this.listingModel.findByIdAndUpdate(id, { isActive }, { new: true }).populate('categoryId').populate('subCategoryId').populate('providerId').exec();

        if (!updated) throw new NotFoundException('Listing not found');

        return this.transformWithPublicUrls(updated);
    }

    private getAddressCoordinates(address: any): [number, number] {
        if (address?.location?.coordinates && address.location.coordinates.length === 2) {
            return address.location.coordinates as [number, number];
        }

        if (Array.isArray(address?.coordinates) && address.coordinates.length === 2) {
            return address.coordinates as [number, number];
        }

        throw new BadRequestException('Address is missing valid coordinates');
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
                    const coords = filters.coordinates.split(',').map((c) => parseFloat(c.trim()));
                    if (coords.length === 2 && !coords.some(isNaN)) {
                        parsed.coordinates = coords;
                    }
                }
            } else if (Array.isArray(filters.coordinates)) {
                parsed.coordinates = filters.coordinates.map((c) => parseFloat(c));
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
    async smartSearch(
        searchText: string,
        otherFilters?: Partial<SearchFilters>
    ): Promise<{
        listings: any[];
        searchType: 'category' | 'subcategory' | 'description';
        matchedTerm?: string;
    }> {
        const searchTerm = searchText.trim();
        let searchType: 'category' | 'subcategory' | 'description' = 'description';
        let matchedTerm: string | undefined;

        const categoryMatch = await this.catalogueModel
            .findOne({
                name: new RegExp(`^${searchTerm}$`, 'i'),
                parentId: null,
            } as any)
            .exec();

        if (categoryMatch) {
            searchType = 'category';
            matchedTerm = categoryMatch.name;
            const filters = {
                ...otherFilters,
                categoryId: categoryMatch._id.toString(),
            };
            const listings = await this.findAll(filters);
            return { listings, searchType, matchedTerm };
        }

        const subCategoryMatch = await this.catalogueModel
            .findOne({
                name: new RegExp(`^${searchTerm}$`, 'i'),
                parentId: { $ne: null },
            } as any)
            .exec();

        if (subCategoryMatch) {
            searchType = 'subcategory';
            matchedTerm = subCategoryMatch.name;
            const filters = {
                ...otherFilters,
                subCategoryId: subCategoryMatch._id.toString(),
            };
            const listings = await this.findAll(filters);
            return { listings, searchType, matchedTerm };
        }

        const filters = {
            ...otherFilters,
            searchText: searchTerm,
        };
        const listings = await this.findAll(filters);
        return { listings, searchType };
    }

    // Add a method to clean up invalid listings (run this once to fix existing data)
    async cleanupInvalidListings(): Promise<{ cleaned: number }> {
        const result = await this.listingModel.deleteMany({
            $or: [{ providerId: null }, { providerId: '' }, { providerId: { $exists: false } }],
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
            photoUrls: this.storageService.getPublicUrls(listing.photos),
        };
    }

    /**
     * Validates if coordinates are in the correct format for MongoDB geospatial Point
     * @param coords - The coordinates to validate
     * @returns true if coordinates are valid [longitude, latitude] format
     */
    private hasValidCoordinates(coords: any): boolean {
        return (
            Array.isArray(coords) &&
            coords.length === 2 &&
            typeof coords[0] === 'number' &&
            typeof coords[1] === 'number' &&
            !isNaN(coords[0]) &&
            !isNaN(coords[1]) &&
            coords[0] >= -180 &&
            coords[0] <= 180 && // Valid longitude range
            coords[1] >= -90 &&
            coords[1] <= 90
        ); // Valid latitude range
    }
}
