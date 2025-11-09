import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query, HttpStatus, HttpCode, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ServiceRequestsService } from '../services/service-requests.service';
import { CreateServiceRequestDto, UpdateServiceRequestDto, AcceptServiceRequestDto, DeclineServiceRequestDto, ServiceRequestFiltersDto } from './dto';
import { FirebaseAuthGuard } from '@identity/guards/firebase-auth.guard';
import { FirebaseStorageService } from '../../common/firebase/firebase-storage.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('Service Requests')
@Controller('service-requests')
@UseGuards(FirebaseAuthGuard)
export class ServiceRequestsController {
    constructor(private readonly serviceRequestsService: ServiceRequestsService, private readonly storageService: FirebaseStorageService) {}

    @Post()
    @UseInterceptors(FilesInterceptor('attachments', 5))
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new service request' })
    @ApiConsumes('multipart/form-data')
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
    async findAll(@Query() filters: ServiceRequestFiltersDto) {
        return this.serviceRequestsService.findAll(filters);
    }

    @Get('my-requests')
    @ApiOperation({ summary: "Get seeker's own service requests" })
    async findMyRequests(@Request() req, @Query() filters: ServiceRequestFiltersDto) {
        const seekerId = req.user.uid || req.user.sub || req.user.userId;
        return this.serviceRequestsService.findAll({
            ...filters,
            seekerId,
        });
    }

    @Get('available')
    @ApiOperation({ summary: 'Get available service requests for a provider' })
    async findAvailableForProvider(@Request() req, @Query() filters: ServiceRequestFiltersDto) {
        const providerId = req.user.uid || req.user.sub || req.user.userId;

        // This will return only requests where the provider was notified
        // The service will handle the filtering based on notification waves
        const availableRequests = await this.serviceRequestsService.findAll({
            status: 'MATCHED' as any,
            page: filters.page,
            limit: filters.limit,
        });

        // Filter to only show requests where this provider was notified
        const providerRequests = availableRequests.requests.filter((request: any) => request.allNotifiedProviders?.some((pid: any) => pid.toString() === providerId));

        return {
            requests: providerRequests,
            total: providerRequests.length,
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific service request by ID' })
    async findOne(@Param('id') id: string, @Request() req) {
        const userId = req.user.uid || req.user.sub || req.user.userId;
        const request = await this.serviceRequestsService.findById(id);

        // Check if user has access to view this request
        const isSeeker = request.seekerId.toString() === userId;
        const isNotifiedProvider = (request as any).allNotifiedProviders?.some((pid: any) => pid.toString() === userId);

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
    async update(@Param('id') id: string, @Body() updateDto: UpdateServiceRequestDto, @Request() req) {
        const userId = req.user.uid || req.user.sub || req.user.userId;
        return this.serviceRequestsService.update(id, updateDto, userId);
    }

    @Post(':id/accept')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Accept a service request (provider only)' })
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
    async cancel(@Param('id') id: string, @Body('reason') reason: string, @Request() req) {
        const userId = req.user.uid || req.user.sub || req.user.userId;
        return this.serviceRequestsService.cancel(id, userId, reason);
    }

    @Get(':id/status')
    @ApiOperation({ summary: 'Get service request status and wave information' })
    async getStatus(@Param('id') id: string, @Request() req) {
        const request = await this.serviceRequestsService.findById(id);

        return {
            requestId: request._id,
            status: request.status,
            currentWave: (request as any).currentWave,
            totalWaves: (request as any).notificationWaves?.length || 0,
            totalProvidersNotified: (request as any).allNotifiedProviders?.length || 0,
            expiresAt: request.expiresAt,
            acceptedBy: (request as any).acceptedProviderId || null,
            orderId: request.orderId || null,
        };
    }

    @Get('stats/provider/:providerId')
    @ApiOperation({ summary: "Get provider's service request statistics" })
    async getProviderStats(@Param('providerId') providerId: string) {
        // Get all requests where provider was notified
        const allRequests = await this.serviceRequestsService.findAll({});

        const notifiedRequests = allRequests.requests.filter((request: any) => request.allNotifiedProviders?.some((pid: any) => pid.toString() === providerId));

        const acceptedRequests = notifiedRequests.filter((request: any) => request.acceptedProviderId?.toString() === providerId);

        const declinedRequests = notifiedRequests.filter((request: any) => request.declinedProviders?.some((pid: any) => pid.toString() === providerId));

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
