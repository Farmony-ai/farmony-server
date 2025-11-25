import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ServiceRequest, ServiceRequestDocument, ServiceRequestStatus, NotificationWave } from '../../../transactions/service-requests/schemas/service-request.entity';
import { ProviderDiscoveryService } from './provider-discovery.service';
import { NotificationService } from '../../../engagement/notifications/services/notification.service';
import { ListingsService } from '../../listings/services/listings.service';
import { OrdersService } from '../../../transactions/service-requests/services/orders.service';
import { WAVE_CONFIG } from '../../../common/config/waves.config';

export interface WaveProcessingResult {
    waveNumber: number;
    providersNotified: number;
    nextWaveScheduled: boolean;
    nextWaveAt?: Date;
}

export interface AcceptanceResult {
    request: ServiceRequest;
    order: any;
}

/**
 * MatchesOrchestratorService orchestrates wave-based provider matching for service requests
 * Extracted from ServiceRequestsService to separate matching concerns
 */
@Injectable()
export class MatchesOrchestratorService {
    private readonly logger = new Logger(MatchesOrchestratorService.name);

    constructor(
        @InjectModel(ServiceRequest.name)
        private readonly serviceRequestModel: Model<ServiceRequestDocument>,
        private readonly providerDiscoveryService: ProviderDiscoveryService,
        private readonly notificationService: NotificationService,
        private readonly listingsService: ListingsService,
        @Inject(forwardRef(() => OrdersService))
        private readonly ordersService: OrdersService
    ) {}

    /**
     * Start the matching process for a new service request
     * Initiates Wave 1 and schedules subsequent waves
     */
    async startForRequest(request: ServiceRequestDocument): Promise<void> {
        this.logger.log(`Starting matching for request ${request._id}`);
        await this.processNextWave(request._id);
    }

    /**
     * Process the next wave of provider notifications
     */
    async processNextWave(requestId: string): Promise<WaveProcessingResult> {
        const request = await this.serviceRequestModel.findById(requestId).populate('categoryId').populate('subCategoryId');

        if (!request) {
            this.logger.warn(`Request ${requestId} not found for wave processing`);
            throw new NotFoundException('Service request not found');
        }

        // Check if request is still eligible for notifications
        if (request.status !== ServiceRequestStatus.OPEN && request.status !== ServiceRequestStatus.MATCHED) {
            this.logger.log(`Request ${requestId} status is ${request.status}, skipping wave`);
            return {
                waveNumber: (request as any).lifecycle?.matching?.currentWave ?? 0,
                providersNotified: 0,
                nextWaveScheduled: false,
            };
        }

        // Check if we've reached max waves
        const currentWave = (request as any).lifecycle?.matching?.currentWave ?? 0;
        if (currentWave >= WAVE_CONFIG.maxWaves) {
            await this.handleNoProvidersAvailable(request);
            return {
                waveNumber: currentWave,
                providersNotified: 0,
                nextWaveScheduled: false,
            };
        }

        const waveNumber = currentWave + 1;
        const radius = WAVE_CONFIG.radiusIncrements[currentWave];

        this.logger.log(`Processing wave ${waveNumber} for request ${requestId} with radius ${radius}m`);

        // Find providers in this radius who haven't been notified yet
        // Extract ObjectId from populated fields (categoryId and subCategoryId might be populated objects)
        const categoryIdString = (request.categoryId as any)?._id?.toString() || request.categoryId.toString();
        const subCategoryIdString = request.subCategoryId
            ? ((request.subCategoryId as any)?._id?.toString() || request.subCategoryId.toString())
            : undefined;

        const candidates = await this.providerDiscoveryService.findCandidates({
            coordinates: request.location.coordinates,
            radiusMeters: radius,
            categoryId: categoryIdString,
            subCategoryId: subCategoryIdString,
            excludeProviderIds: ((request as any).lifecycle?.matching?.allNotifiedProviders ?? []).map((id: any) => id.toString()),
        });

        if (candidates.length < WAVE_CONFIG.minProvidersPerWave) {
            // Not enough new providers in this wave, schedule next wave with delay
            if (currentWave >= WAVE_CONFIG.maxWaves - 1) {
                await this.handleNoProvidersAvailable(request);
                return {
                    waveNumber: waveNumber,
                    providersNotified: 0,
                    nextWaveScheduled: false,
                };
            } else {
                // Schedule next wave with delay
                const nextWaveAt = new Date();
                nextWaveAt.setMinutes(nextWaveAt.getMinutes() + WAVE_CONFIG.waveDelayMinutes);

                (request as any).lifecycle = (request as any).lifecycle || {};
                (request as any).lifecycle.matching = (request as any).lifecycle.matching || {};
                (request as any).lifecycle.matching.currentWave = waveNumber;
                (request as any).lifecycle.matching.nextWaveAt = nextWaveAt;
                await request.save();

                this.logger.log(`Insufficient providers in wave ${waveNumber}, scheduling wave ${waveNumber + 1} for ${nextWaveAt.toISOString()}`);
                return {
                    waveNumber,
                    providersNotified: 0,
                    nextWaveScheduled: true,
                    nextWaveAt,
                };
            }
        }

        // Create wave record
        const wave: NotificationWave = {
            waveNumber,
            radius,
            notifiedProviders: candidates.map((c) => new Types.ObjectId(c.providerId)),
            notifiedAt: new Date(),
            providersCount: candidates.length,
        };

        // Update request with wave info
        (request as any).lifecycle = (request as any).lifecycle || {};
        (request as any).lifecycle.matching = (request as any).lifecycle.matching || { notificationWaves: [], allNotifiedProviders: [], declinedProviders: [] };
        (request as any).lifecycle.matching.notificationWaves.push(wave as any);
        (request as any).lifecycle.matching.currentWave = waveNumber;
        (request as any).lifecycle.matching.allNotifiedProviders.push(...candidates.map((c) => new Types.ObjectId(c.providerId)));
        request.status = ServiceRequestStatus.MATCHED;

        // Set next wave time if not the last wave
        let nextWaveAt: Date | undefined;
        if (waveNumber < WAVE_CONFIG.maxWaves) {
            nextWaveAt = new Date();
            nextWaveAt.setMinutes(nextWaveAt.getMinutes() + WAVE_CONFIG.waveDelayMinutes);
            (request as any).lifecycle.matching.nextWaveAt = nextWaveAt;
        }

        await request.save();

        // Notify providers in this wave
        await this.notifyProvidersInWave(request, candidates);

        this.logger.log(`Notified ${candidates.length} providers in wave ${waveNumber} for request ${requestId}`);

        return {
            waveNumber,
            providersNotified: candidates.length,
            nextWaveScheduled: !!nextWaveAt,
            nextWaveAt,
        };
    }

    /**
     * Schedule the next wave for processing
     */
    async scheduleNextWave(requestId: string, at: Date): Promise<void> {
        await this.serviceRequestModel.findByIdAndUpdate(requestId, {
            $set: { 'lifecycle.matching.nextWaveAt': at },
        });

        this.logger.debug(`Scheduled next wave for request ${requestId} at ${at.toISOString()}`);
    }

    /**
     * Handle provider acceptance of a service request
     * Uses atomic update to prevent race conditions
     * Creates order and updates request status
     */
    async accept(requestId: string, providerId: string): Promise<AcceptanceResult> {
        const request = await this.serviceRequestModel.findById(requestId);

        if (!request) {
            throw new NotFoundException('Service request not found');
        }

        // Check if provider was notified
        if (!((request as any).lifecycle?.matching?.allNotifiedProviders || []).some((pid: any) => pid.toString() === providerId)) {
            throw new ForbiddenException('You were not notified about this request');
        }

        // Check request status
        if (request.status !== ServiceRequestStatus.MATCHED) {
            throw new BadRequestException('Request is no longer available');
        }

        if (new Date() > request.expiresAt) {
            throw new BadRequestException('Request has expired');
        }

        // Get provider's listing for this category AND subcategory
        const providerListings = await this.listingsService.findByProvider(providerId);
        const matchingListing = providerListings.find((listing) => {
            const categoryMatch = listing.categoryId?._id?.toString() === request.categoryId.toString() || listing.categoryId?.toString() === request.categoryId.toString();

            let subCategoryMatch = true;
            if (request.subCategoryId) {
                subCategoryMatch =
                    listing.subCategoryId?._id?.toString() === request.subCategoryId.toString() || listing.subCategoryId?.toString() === request.subCategoryId.toString();
            }

            return categoryMatch && subCategoryMatch && listing.isActive;
        });

        if (!matchingListing) {
            const errorMsg = request.subCategoryId ? "You don't have an active listing for this category and subcategory" : "You don't have an active listing for this category";
            throw new BadRequestException(errorMsg);
        }

        // Calculate total amount based on listing price and request metadata
        let totalAmount = matchingListing.price;
        if (request.metadata?.quantity) {
            totalAmount *= request.metadata.quantity;
        }
        if (request.metadata?.duration) {
            // If price is per hour and duration is specified
            if (matchingListing.unitOfMeasure === 'per_hour') {
                totalAmount = matchingListing.price * request.metadata.duration;
            }
        }

        // Atomic update to prevent race conditions
        const result = await this.serviceRequestModel.findOneAndUpdate(
            {
                _id: requestId,
                status: ServiceRequestStatus.MATCHED,
                'lifecycle.matching.allNotifiedProviders': new Types.ObjectId(providerId),
            },
            {
                $set: {
                    status: ServiceRequestStatus.ACCEPTED,
                    // lifecycle fields
                    'lifecycle.order.providerId': new Types.ObjectId(providerId),
                    'lifecycle.order.listingId': new Types.ObjectId(matchingListing._id),
                    'lifecycle.order.acceptedAt': new Date(),
                    'lifecycle.order.agreedPrice': matchingListing.price,
                },
            },
            { new: true }
        );

        if (!result) {
            throw new BadRequestException('Request has already been accepted by another provider');
        }

        // Create order
        const orderData = {
            seekerId: request.seekerId.toString(),
            providerId: providerId,
            listingId: matchingListing._id,
            serviceRequestId: requestId,
            categoryId: request.categoryId.toString(),
            subCategoryId: request.subCategoryId?.toString(),
            totalAmount,
            coordinates: request.location.coordinates,
            serviceStartDate: request.serviceStartDate,
            serviceEndDate: request.serviceEndDate,
            description: request.description,
            quantity: request.metadata?.quantity,
            unitOfMeasure: matchingListing.unitOfMeasure,
            metadata: {
                ...request.metadata,
                requestTitle: request.title,
                listingTitle: matchingListing.title,
                listingPrice: matchingListing.price,
            },
        };

        const order = await this.ordersService.createFromServiceRequest(orderData);

        // Update request with order ref and payment info
        await this.serviceRequestModel.updateOne(
          { _id: requestId },
          {
            $set: {
              'lifecycle.order.orderRef': (order as any)._id,
              'lifecycle.order.payment.totalAmount': totalAmount,
            },
          }
        );

        // Notify seeker about acceptance
        await this.notificationService.notifySeekerAccepted(request.seekerId.toString(), {
            requestId,
            providerId,
            providerName: matchingListing.providerId?.name || 'Service Provider',
            orderId: (order as any)._id,
            totalAmount,
        });

        // Notify all other notified providers that request is no longer available
        const otherProviders = ((request as any).lifecycle?.matching?.allNotifiedProviders || [])
            .filter((pid: any) => pid.toString() !== providerId)
            .map((pid: any) => pid.toString());

        await this.notificationService.notifyProvidersClosed(otherProviders, requestId, 'accepted_by_another');

        this.logger.log(`Request ${requestId} accepted by provider ${providerId}, order ${(order as any)._id} created`);

        return {
            request: result.toObject(),
            order,
        };
    }

    /**
     * Handle provider declining a service request
     */
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

        this.logger.log(`Provider ${providerId} declined request ${requestId}${reason ? `: ${reason}` : ''}`);
    }

    /**
     * Notify providers in a wave about new request opportunity
     */
    private async notifyProvidersInWave(request: ServiceRequestDocument, candidates: any[]): Promise<void> {
        const categoryName = (request.categoryId as any)?.name || 'Service';
        const subCategoryName = (request.subCategoryId as any)?.name;

        const providerIds = candidates.map((c) => c.providerId);

        await this.notificationService.notifyProvidersNewRequest(request._id, providerIds, {
            requestId: request._id,
            title: request.title,
            description: request.description,
            categoryName,
            subCategoryName,
            distanceKm: Math.round((candidates[0]?.distanceMeters / 1000) * 10) / 10, // Round to 1 decimal
            serviceStartDate: request.serviceStartDate,
            serviceEndDate: request.serviceEndDate,
        });
    }

    /**
     * Handle case when no providers are available after all waves
     */
    private async handleNoProvidersAvailable(request: ServiceRequestDocument): Promise<void> {
        request.status = ServiceRequestStatus.NO_PROVIDERS_AVAILABLE;
        request.cancellationReason = 'No service providers available in your area';
        await request.save();

        await this.notificationService.notifySeekerNoProviders(request.seekerId.toString(), request._id);

        this.logger.log(`Request ${request._id} marked as NO_PROVIDERS_AVAILABLE`);
    }
}
