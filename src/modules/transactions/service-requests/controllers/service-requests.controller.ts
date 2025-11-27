import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query, HttpStatus, HttpCode, UseInterceptors, UploadedFiles, Logger } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ServiceRequestsService } from '../services/service-requests.service';
import { CreateServiceRequestDto, UpdateServiceRequestDto, AcceptServiceRequestDto, DeclineServiceRequestDto, ServiceRequestFiltersDto } from '../dto';
import { FirebaseAuthGuard } from '../../../identity/guards/firebase-auth.guard';
import { FirebaseStorageService } from '../../../common/firebase/firebase-storage.service';
import { GeoService } from '../../../common/geo/geo.service';
import { ListingsService } from '../../../marketplace/listings/services/listings.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { ServiceRequestStatusDto } from '../dto/service-request-status.dto';
import { AcceptServiceRequestResponseDto, PaginatedServiceRequestsDto, ServiceRequestResponseDto } from '../dto/service-request-response.dto';

@ApiTags('Service Requests')
@Controller('service-requests')
@UseGuards(FirebaseAuthGuard)
export class ServiceRequestsController {
    private readonly logger = new Logger(ServiceRequestsController.name);

    constructor(
        private readonly serviceRequestsService: ServiceRequestsService,
        private readonly storageService: FirebaseStorageService,
        private readonly geoService: GeoService,
        private readonly listingsService: ListingsService,
    ) {}

    @Post()
    @UseInterceptors(FilesInterceptor('attachments', 5))
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new service request' })
    @ApiConsumes('multipart/form-data')
    @ApiCreatedResponse({ type: ServiceRequestResponseDto })
    async create(@UploadedFiles() files: Express.Multer.File[], @Body() createDto: CreateServiceRequestDto, @Request() req) {
        const seekerId = req.user.uid || req.user.sub || req.user.userId;

        // Handle file uploads if any
        let attachmentKeys = [];
        if (files && files.length > 0) {
            attachmentKeys = await Promise.all(files.map((file) => this.storageService.uploadFile(file, 'service-requests')));
            createDto.attachments = attachmentKeys;
        }

        return this.serviceRequestsService.create(createDto, seekerId);
    }

    @Get()
    @ApiOperation({ summary: 'Get all service requests with filters' })
    @ApiOkResponse({ type: PaginatedServiceRequestsDto })
    async findAll(@Query() filters: ServiceRequestFiltersDto) {
        return this.serviceRequestsService.findAll(filters);
    }

    @Get('my-requests')
    @ApiOperation({ summary: "Get seeker's own service requests" })
    @ApiOkResponse({ type: PaginatedServiceRequestsDto })
    async findMyRequests(@Request() req, @Query() filters: ServiceRequestFiltersDto) {
        const seekerId = req.user.uid || req.user.sub || req.user.userId;
        return this.serviceRequestsService.findAll({
            ...filters,
            seekerId,
        });
    }

    @Get('available')
    @ApiOperation({ summary: 'Get available service requests for a provider based on location and categories' })
    @ApiOkResponse({ type: PaginatedServiceRequestsDto })
    async findAvailableForProvider(@Request() req, @Query() filters: ServiceRequestFiltersDto) {
        const providerId = req.user.uid || req.user.sub || req.user.userId;
        this.logger.debug(`Finding available requests for provider ${providerId}`);

        // 1. Get provider's default address for location-based search
        let defaultAddress: any = null;
        try {
            defaultAddress = await this.geoService.getDefaultAddress(providerId);
        } catch (error) {
            this.logger.warn(`Could not get default address for provider ${providerId}: ${error.message}`);
        }

        if (!defaultAddress?.location?.coordinates) {
            // Fallback: return only already-notified requests (push-based)
            this.logger.debug(`No default address for provider ${providerId}, using fallback`);
            return this.getFallbackNotifiedRequests(providerId, filters);
        }

        const coordinates: [number, number] = defaultAddress.location.coordinates;

        // 2. Get provider's listings to find their categories
        let providerListings: any[] = [];
        try {
            providerListings = await this.listingsService.findByProvider(providerId);
        } catch (error) {
            this.logger.warn(`Could not get listings for provider ${providerId}: ${error.message}`);
        }

        if (!providerListings || providerListings.length === 0) {
            this.logger.debug(`No listings for provider ${providerId}`);
            return { requests: [], total: 0 };
        }

        // Extract unique category IDs and subcategory IDs from active listings
        const categoryIds = [...new Set(
            providerListings
                .filter(l => l.isActive && l.categoryId)
                .map(l => l.categoryId._id?.toString() || l.categoryId.toString())
        )];

        const subCategoryIds = [...new Set(
            providerListings
                .filter(l => l.isActive && l.subCategoryId)
                .map(l => l.subCategoryId._id?.toString() || l.subCategoryId.toString())
        )];

        if (categoryIds.length === 0) {
            this.logger.debug(`No active categories for provider ${providerId}`);
            return { requests: [], total: 0 };
        }

        this.logger.debug(`Provider ${providerId} has categories: ${categoryIds.join(', ')}, subcategories: ${subCategoryIds.join(', ')}`);

        // 3. Find nearby requests matching provider's categories (pull-based)
        const radiusMeters = 40000; // 40km - matches max wave radius from config
        const nearbyResult = await this.serviceRequestsService.findNearbyForProvider(
            providerId,
            coordinates,
            categoryIds,
            subCategoryIds,
            radiusMeters,
        );

        // 4. Also include requests where provider was already notified (push-based)
        // This ensures backward compatibility with the wave notification system
        const notifiedRequests = await this.getNotifiedRequests(providerId, filters);

        // 5. Merge and deduplicate (nearby takes precedence for distance info)
        const nearbyIds = new Set(nearbyResult.requests.map((r: any) => r._id.toString()));
        const additionalNotified = notifiedRequests.filter((r: any) => !nearbyIds.has(r._id.toString()));

        const allRequests = [...nearbyResult.requests, ...additionalNotified];

        this.logger.debug(`Found ${nearbyResult.requests.length} nearby + ${additionalNotified.length} notified = ${allRequests.length} total for provider ${providerId}`);

        return {
            requests: allRequests,
            total: allRequests.length,
        };
    }

    /**
     * Helper method to get requests where provider was notified via wave system
     */
    private async getNotifiedRequests(providerId: string, filters: ServiceRequestFiltersDto) {
        const allMatched = await this.serviceRequestsService.findAll({
            status: 'MATCHED' as any,
            page: filters.page,
            limit: filters.limit,
        });

        return allMatched.requests.filter((request: any) =>
            (request.lifecycle?.matching?.allNotifiedProviders || [])
                .some((pid: any) => pid.toString() === providerId) &&
            !(request.lifecycle?.matching?.declinedProviders || [])
                .some((pid: any) => pid.toString() === providerId)
        );
    }

    /**
     * Fallback when provider has no default address - return only wave-notified requests
     */
    private async getFallbackNotifiedRequests(providerId: string, filters: ServiceRequestFiltersDto) {
        const requests = await this.getNotifiedRequests(providerId, filters);
        return { requests, total: requests.length };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific service request by ID' })
    @ApiOkResponse({ type: ServiceRequestResponseDto })
    async findOne(@Param('id') id: string, @Request() req) {
        const userId = req.user.uid || req.user.sub || req.user.userId;
        const request = await this.serviceRequestsService.findById(id);

        // Check if user has access to view this request
        const isSeeker = request.seekerId.toString() === userId;
        const isNotifiedProvider = (request as any).lifecycle?.matching?.allNotifiedProviders?.some((pid: any) => pid.toString() === userId);

        if (!isSeeker && !isNotifiedProvider) {
            // Return limited information for non-authorized users
            return {
                _id: request._id,
                status: request.status,
                message: 'You do not have access to view full details of this request',
            };
        }

        return request;
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a service request (seeker only)' })
    @ApiOkResponse({ type: ServiceRequestResponseDto })
    async update(@Param('id') id: string, @Body() updateDto: UpdateServiceRequestDto, @Request() req) {
        const userId = req.user.uid || req.user.sub || req.user.userId;
        return this.serviceRequestsService.update(id, updateDto, userId);
    }

    @Post(':id/accept')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Accept a service request (provider only)' })
    @ApiOkResponse({ type: AcceptServiceRequestResponseDto })
    async accept(@Param('id') id: string, @Body() acceptDto: AcceptServiceRequestDto, @Request() req) {
        const providerId = req.user.uid || req.user.sub || req.user.userId;
        return this.serviceRequestsService.accept(id, providerId, acceptDto);
    }

    @Post(':id/decline')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Decline a service request (provider only)' })
    async decline(@Param('id') id: string, @Body() declineDto: DeclineServiceRequestDto, @Request() req) {
        const providerId = req.user.uid || req.user.sub || req.user.userId;
        await this.serviceRequestsService.decline(id, providerId, declineDto.reason);
        return {
            message: 'Service request declined successfully',
        };
    }

    @Post(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel a service request (seeker only)' })
    @ApiOkResponse({ type: ServiceRequestResponseDto })
    async cancel(@Param('id') id: string, @Body('reason') reason: string, @Request() req) {
        const userId = req.user.uid || req.user.sub || req.user.userId;
        return this.serviceRequestsService.cancel(id, userId, reason);
    }

    @Get(':id/status')
    @ApiOperation({ summary: 'Get service request status and wave information' })
    @ApiOkResponse({ type: ServiceRequestStatusDto })
    async getStatus(@Param('id') id: string, @Request() req) {
        const request = await this.serviceRequestsService.findById(id);

        const lifecycle = (request as any).lifecycle || {};
        const matching = lifecycle.matching || {};
        const order = lifecycle.order || {};
        const response: ServiceRequestStatusDto = {
            requestId: request._id,
            status: request.status,
            currentWave: matching.currentWave ?? (request as any).currentWave,
            totalWaves: (matching.notificationWaves?.length) || (request as any).notificationWaves?.length || 0,
            totalProvidersNotified: (matching.allNotifiedProviders?.length) || (request as any).allNotifiedProviders?.length || 0,
            expiresAt: request.expiresAt,
            acceptedBy: order.providerId || (request as any).acceptedProviderId || null,
            orderId: (order as any).orderId || (order as any).orderRef || (order as any).lifecycle?.order?.orderRef || null,
        };
        return response;
    }

    @Get('stats/provider/:providerId')
    @ApiOperation({ summary: "Get provider's service request statistics" })
    async getProviderStats(@Param('providerId') providerId: string) {
        // Get all requests where provider was notified
        const allRequests = await this.serviceRequestsService.findAll({});

        const notifiedRequests = allRequests.requests.filter((request: any) => ((request.lifecycle?.matching?.allNotifiedProviders ?? request.allNotifiedProviders) || [])
            .some((pid: any) => pid.toString() === providerId));

        const acceptedRequests = notifiedRequests.filter((request: any) => (request.lifecycle?.order?.providerId?.toString?.() || request.acceptedProviderId?.toString?.()) === providerId);

        const declinedRequests = notifiedRequests.filter((request: any) => ((request.lifecycle?.matching?.declinedProviders ?? request.declinedProviders) || [])
            .some((pid: any) => pid.toString() === providerId));

        return {
            totalNotified: notifiedRequests.length,
            totalAccepted: acceptedRequests.length,
            totalDeclined: declinedRequests.length,
            totalPending: notifiedRequests.filter((r: any) => r.status === 'MATCHED').length,
            acceptanceRate: notifiedRequests.length > 0 ? (acceptedRequests.length / notifiedRequests.length) * 100 : 0,
        };
    }

    // Admin endpoint to manually trigger wave processing
    @Post('admin/process-waves')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Manually trigger wave processing (admin only)' })
    async processWaves() {
        // This would typically be protected with an admin guard
        await this.serviceRequestsService.processScheduledWaves();
    }

    // Admin endpoint to expire old requests
    @Post('admin/expire-old')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Manually expire old requests (admin only)' })
    async expireOldRequests() {
        // This would typically be protected with an admin guard
        await this.serviceRequestsService.expireOldRequests();
    }
}
