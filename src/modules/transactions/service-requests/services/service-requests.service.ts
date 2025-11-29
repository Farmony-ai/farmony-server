import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { ServiceRequest, ServiceRequestDocument, ServiceRequestStatus, NotificationWave } from '../schemas/service-request.entity';
import { CreateServiceRequestDto } from '../dto/create-service-request.dto';
import { UpdateServiceRequestDto } from '../dto/update-service-request.dto';
import { AcceptServiceRequestDto } from '../dto/accept-service-request.dto';
import { ListingsService } from '../../../marketplace/listings/services/listings.service';
import { OrdersService } from './orders.service';
import { WAVE_CONFIG } from '../../../common/config/waves.config';
import { GeoService } from '../../../common/geo/geo.service';
import { NotificationService } from '../../../engagement/notifications/services/notification.service';
import { MatchesOrchestratorService } from '../../../marketplace/matches/services/matches-orchestrator.service';

@Injectable()
export class ServiceRequestsService {
    private readonly logger = new Logger(ServiceRequestsService.name);

    constructor(
        @InjectModel(ServiceRequest.name)
        private readonly serviceRequestModel: Model<ServiceRequestDocument>,
        private readonly listingsService: ListingsService,
        private readonly ordersService: OrdersService,
        private readonly geoService: GeoService,
        private readonly notificationService: NotificationService,
        @Inject(forwardRef(() => MatchesOrchestratorService))
        private readonly matchesOrchestratorService: MatchesOrchestratorService
    ) { }

    async create(createDto: CreateServiceRequestDto, seekerId: string): Promise<ServiceRequest> {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + WAVE_CONFIG.expiryHours);

        const requestId = uuidv4();

        // Use GeoService for address resolution
        const { serviceAddressId, coordinates } = await this.geoService.resolveForServiceRequestCreate(seekerId, createDto);

        const serviceRequest = new this.serviceRequestModel({
            _id: requestId,
            seekerId: new Types.ObjectId(seekerId),
            categoryId: new Types.ObjectId(createDto.categoryId),
            subCategoryId: createDto.subCategoryId ? new Types.ObjectId(createDto.subCategoryId) : undefined,
            title: createDto.title,
            description: createDto.description,
            location: {
                type: 'Point',
                coordinates: coordinates,
            },
            serviceAddressId: new Types.ObjectId(serviceAddressId),
            serviceStartDate: createDto.serviceStartDate,
            serviceEndDate: createDto.serviceEndDate,
            status: ServiceRequestStatus.OPEN,
            expiresAt,
            metadata: createDto.metadata,
            attachments: createDto.attachments || [],
            // legacy fields (for compatibility)
            currentWave: 0,
            notificationWaves: [],
            allNotifiedProviders: [],
            // lifecycle fields
            lifecycle: {
                matching: {
                    currentWave: 0,
                    notificationWaves: [],
                    allNotifiedProviders: [],
                },
            },
        });

        const savedRequest = await serviceRequest.save();

        // Start the first wave of notifications
        await this.matchesOrchestratorService.startForRequest(savedRequest);

        return savedRequest;
    }

    async update(id: string, updateDto: UpdateServiceRequestDto, userId: string): Promise<ServiceRequest> {
        const request = await this.serviceRequestModel.findById(id);

        if (!request) {
            throw new NotFoundException('Service request not found');
        }

        if (request.seekerId.toString() !== userId) {
            throw new ForbiddenException('You can only update your own service requests');
        }

        if (request.status !== ServiceRequestStatus.OPEN && request.status !== ServiceRequestStatus.MATCHED) {
            throw new BadRequestException('Only open or matched requests can be updated');
        }

        const updatePayload: any = {};

        const updateAddressId = updateDto.addressId ?? updateDto.serviceAddressId;

        if (updateAddressId) {
            const { serviceAddressId, coordinates } = await this.geoService.resolveForServiceRequestUpdate(userId, updateAddressId);
            updatePayload.serviceAddressId = new Types.ObjectId(serviceAddressId);
            updatePayload.location = {
                type: 'Point',
                coordinates: coordinates,
            };
            // ensure lifecycle exists (no-op for persistence if not present)
            updatePayload['lifecycle.matching'] = (request as any).lifecycle?.matching || { currentWave: 0, notificationWaves: [] };
        }

        const mutableFields: Array<keyof UpdateServiceRequestDto> = ['title', 'description', 'serviceStartDate', 'serviceEndDate', 'metadata', 'attachments', 'cancellationReason'];

        for (const field of mutableFields) {
            if (updateDto[field] !== undefined) {
                updatePayload[field] = updateDto[field];
            }
        }

        if (Object.keys(updatePayload).length === 0) {
            return this.findById(id);
        }

        const updated = await this.serviceRequestModel.findByIdAndUpdate(id, { $set: updatePayload }, { new: true });

        if (!updated) {
            throw new NotFoundException('Service request not found');
        }

        return this.findById(id);
    }

    async accept(id: string, providerId: string, acceptDto?: AcceptServiceRequestDto): Promise<{ request: ServiceRequest; order: any }> {
        return await this.matchesOrchestratorService.accept(id, providerId);
    }

    // Cron job to process pending waves
    @Cron(CronExpression.EVERY_MINUTE)

    // Cron job to expire old requests
    @Cron(CronExpression.EVERY_10_MINUTES)
    async expireOldRequests() {
        const now = new Date();
        const expiredRequests = await this.serviceRequestModel
            .find({
                status: { $in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.MATCHED] },
                expiresAt: { $lt: now },
                isAutoExpired: false,
            })
            .limit(20);

        for (const request of expiredRequests) {
            try {
                await this.expire(request._id);
            } catch (error) {
                this.logger.error(`Error expiring request ${request._id}:`, error);
            }
        }
    }

    async expire(id: string): Promise<ServiceRequest> {
        const updatedRequest = await this.serviceRequestModel
            .findByIdAndUpdate(
                id,
                {
                    $set: {
                        status: ServiceRequestStatus.EXPIRED,
                        isAutoExpired: true,
                        cancellationReason: 'Request expired - no provider accepted in time',
                    },
                },
                { new: true }
            )
            .lean();

        if (!updatedRequest) {
            throw new NotFoundException('Service request not found');
        }

        // Notify seeker using NotificationService
        await this.notificationService.notifySeekerExpired(updatedRequest.seekerId.toString(), id);

        // Notify all notified providers using NotificationService
        const providerIds = ((updatedRequest as any).lifecycle?.matching?.allNotifiedProviders || []).map((pid: any) => pid.toString());
        await this.notificationService.notifyProvidersClosed(providerIds, id, 'expired');

        return updatedRequest;
    }

    async cancel(id: string, userId: string, reason?: string): Promise<ServiceRequest> {
        const request = await this.findById(id);

        if (request.seekerId.toString() !== userId) {
            throw new ForbiddenException('You can only cancel your own requests');
        }

        if (request.status === ServiceRequestStatus.COMPLETED || request.status === ServiceRequestStatus.CANCELLED) {
            throw new BadRequestException('Cannot cancel request in current status');
        }

        // In lifecycle model, once accepted, cancellation is restricted; enforce by status only
        if (request.status === ServiceRequestStatus.ACCEPTED) {
            throw new BadRequestException('Cannot cancel accepted request. Please cancel the order instead.');
        }

        const updatedRequest = await this.serviceRequestModel
            .findByIdAndUpdate(
                id,
                {
                    $set: {
                        status: ServiceRequestStatus.CANCELLED,
                        cancellationReason: reason || 'Cancelled by user',
                    },
                },
                { new: true }
            )
            .lean();

        // Notify all notified providers using NotificationService
        const providerIds = ((request as any).lifecycle?.matching?.allNotifiedProviders || []).map((pid: any) => pid.toString());
        await this.notificationService.notifyProvidersClosed(providerIds, id, 'cancelled');

        return updatedRequest;
    }

    async findById(id: string): Promise<ServiceRequest> {
        const request = await this.serviceRequestModel
            .findById(id)
            .populate('seekerId', 'name phone email profilePictureKey')
            .populate('categoryId', 'name icon')
            .populate('subCategoryId', 'name')
            .populate('lifecycle.order.providerId', 'name phone profilePicture')
            .populate('lifecycle.order.listingId', 'title price unitOfMeasure')
            .lean();

        if (!request) {
            throw new NotFoundException('Service request not found');
        }

        // Note: serviceAddressId references an embedded Address in User.addresses array
        // Cannot populate embedded documents, address string should be set during creation

        return request;
    }

    async findAll(filters: {
        status?: ServiceRequestStatus;
        categoryId?: string;
        seekerId?: string;
        page?: number;
        limit?: number;
    }): Promise<{ requests: ServiceRequest[]; total: number }> {
        const query: any = {};
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const skip = (page - 1) * limit;

        if (filters.status) {
            query.status = filters.status;
        }

        if (filters.categoryId) {
            query.categoryId = new Types.ObjectId(filters.categoryId);
        }

        if (filters.seekerId) {
            query.seekerId = new Types.ObjectId(filters.seekerId);
        }

        const [requests, total] = await Promise.all([
            this.serviceRequestModel
                .find(query)
                .populate('seekerId', 'name phone email')
                .populate('categoryId', 'name icon')
                .populate('subCategoryId', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.serviceRequestModel.countDocuments(query),
        ]);

        // Note: serviceAddressId references embedded Address in User.addresses array
        // Cannot populate embedded documents, address string should be set during creation
        const requestsWithAddresses = requests.map((request) => {
            return request;
        });

        return { requests: requestsWithAddresses, total };
    }

    async decline(requestId: string, providerId: string, reason?: string): Promise<void> {
        const request = await this.serviceRequestModel.findById(requestId);

        if (!request) {
            throw new NotFoundException('Service request not found');
        }

        if (!((request as any).lifecycle?.matching?.allNotifiedProviders || []).some((pid: any) => pid.toString() === providerId)) {
            throw new ForbiddenException('You were not notified about this request');
        }

        // Add to declined providers list
        const declined = ((request as any).lifecycle?.matching?.declinedProviders || []).map((pid: any) => pid.toString());
        if (!declined.includes(providerId)) {
            (request as any).lifecycle = (request as any).lifecycle || {};
            (request as any).lifecycle.matching = (request as any).lifecycle.matching || { declinedProviders: [] };
            (request as any).lifecycle.matching.declinedProviders.push(new Types.ObjectId(providerId));
            await request.save();
        }

        this.logger.log(`Provider ${providerId} declined request ${requestId}`);
    }

    /**
     * Find nearby service requests for a provider based on their location and categories
     * Pull-based approach - queries in real-time based on provider's profile
     * Used for "Open Opportunities" feature in provider dashboard
     */
    async findNearbyForProvider(
        providerId: string,
        coordinates: [number, number], // [lon, lat]
        categoryIds: string[],
        subCategoryIds: string[],
        radiusMeters: number = 40000 // Default 40km (max wave radius)
    ): Promise<{ requests: ServiceRequest[]; total: number }> {
        this.logger.debug(`Finding nearby requests for provider ${providerId} within ${radiusMeters}m`);

        // Build the base query for $geoNear
        const baseQuery: any = {
            status: { $in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.MATCHED] },
            expiresAt: { $gt: new Date() },
            categoryId: { $in: categoryIds.map(id => new Types.ObjectId(id)) },
        };

        // Exclude requests the provider has declined
        baseQuery['lifecycle.matching.declinedProviders'] = { $nin: [new Types.ObjectId(providerId)] };

        // If subCategoryIds provided, filter by them (or allow requests without subcategory)
        if (subCategoryIds.length > 0) {
            baseQuery.$or = [
                { subCategoryId: { $in: subCategoryIds.map(id => new Types.ObjectId(id)) } },
                { subCategoryId: { $exists: false } },
                { subCategoryId: null },
            ];
        }

        const pipeline: any[] = [
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: coordinates,
                    },
                    distanceField: 'distanceMeters',
                    maxDistance: radiusMeters,
                    spherical: true,
                    query: baseQuery,
                },
            },
            // Lookup seeker info
            {
                $lookup: {
                    from: 'users',
                    localField: 'seekerId',
                    foreignField: '_id',
                    as: 'seekerData',
                },
            },
            {
                $addFields: {
                    seekerId: {
                        $cond: {
                            if: { $gt: [{ $size: '$seekerData' }, 0] },
                            then: {
                                _id: { $arrayElemAt: ['$seekerData._id', 0] },
                                name: { $arrayElemAt: ['$seekerData.name', 0] },
                                phone: { $arrayElemAt: ['$seekerData.phone', 0] },
                                email: { $arrayElemAt: ['$seekerData.email', 0] },
                            },
                            else: '$seekerId',
                        },
                    },
                },
            },
            { $unset: 'seekerData' },
            // Lookup category info
            {
                $lookup: {
                    from: 'catalogues',
                    localField: 'categoryId',
                    foreignField: '_id',
                    as: 'categoryData',
                },
            },
            {
                $addFields: {
                    categoryId: {
                        $cond: {
                            if: { $gt: [{ $size: '$categoryData' }, 0] },
                            then: {
                                _id: { $arrayElemAt: ['$categoryData._id', 0] },
                                name: { $arrayElemAt: ['$categoryData.name', 0] },
                                icon: { $arrayElemAt: ['$categoryData.icon', 0] },
                            },
                            else: '$categoryId',
                        },
                    },
                },
            },
            { $unset: 'categoryData' },
            // Lookup subcategory info
            {
                $lookup: {
                    from: 'catalogues',
                    localField: 'subCategoryId',
                    foreignField: '_id',
                    as: 'subCategoryData',
                },
            },
            {
                $addFields: {
                    subCategoryId: {
                        $cond: {
                            if: { $gt: [{ $size: '$subCategoryData' }, 0] },
                            then: {
                                _id: { $arrayElemAt: ['$subCategoryData._id', 0] },
                                name: { $arrayElemAt: ['$subCategoryData.name', 0] },
                            },
                            else: '$subCategoryId',
                        },
                    },
                },
            },
            { $unset: 'subCategoryData' },
            // Sort by distance (nearest first)
            { $sort: { distanceMeters: 1 } },
            // Limit results
            { $limit: 50 },
        ];

        const results = await this.serviceRequestModel.aggregate(pipeline).exec();

        this.logger.debug(`Found ${results.length} nearby requests for provider ${providerId}`);

        return {
            requests: results,
            total: results.length,
        };
    }

    /**
     * Process scheduled waves for all open service requests
     * This is typically called by a cron job or manually by admin
     * Delegates to MatchesOrchestratorService for wave processing
     */
    async processScheduledWaves(): Promise<void> {
        this.logger.log('Processing scheduled waves...');

        try {
            // Find all open service requests that need wave processing
            const openRequests = await this.serviceRequestModel.find({
                status: ServiceRequestStatus.OPEN,
                expiresAt: { $gt: new Date() }
            });

            this.logger.log(`Found ${openRequests.length} open requests for wave processing`);

            // Process each request through the orchestrator
            for (const request of openRequests) {
                try {
                    await this.matchesOrchestratorService.processNextWave(request._id);
                } catch (error) {
                    this.logger.error(`Error processing wave for request ${request._id}:`, error);
                }
            }

            this.logger.log('Completed wave processing');
        } catch (error) {
            this.logger.error('Error in processScheduledWaves:', error);
            throw error;
        }
    }
    /**
     * Find service requests within a bounding box
     * Optimized for map view - returns lightweight data
     */
    async findInBoundingBox(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<any[]> {
        const { minLat, maxLat, minLng, maxLng } = bounds;

        // Construct polygon for box
        // MongoDB expects: [[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]
        // But for $geoWithin $box it's simpler: [[minLng, minLat], [maxLng, maxLat]]

        const query = {
            status: { $in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.MATCHED] },
            expiresAt: { $gt: new Date() },
            location: {
                $geoWithin: {
                    $box: [
                        [minLng, minLat], // Bottom Left
                        [maxLng, maxLat]  // Top Right
                    ]
                }
            }
        };

        const requests = await this.serviceRequestModel
            .find(query)
            .select('_id title location status categoryId subCategoryId expiresAt') // Select only needed fields
            .populate('categoryId', 'name icon')
            .lean()
            .limit(500); // Safety limit

        return requests;
    }
}
