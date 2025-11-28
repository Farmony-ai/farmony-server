import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServiceRequestsService } from '../services/service-requests.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Public Service Requests')
@Controller('public/service-requests')
export class PublicServiceRequestsController {
    private readonly logger = new Logger(PublicServiceRequestsController.name);

    constructor(
        private readonly serviceRequestsService: ServiceRequestsService,
    ) { }

    @Get('map')
    @Public()
    @ApiOperation({ summary: 'Get service requests within a map bounding box (Public)' })
    async getMapRequests(
        @Query('minLat') minLat: string,
        @Query('maxLat') maxLat: string,
        @Query('minLng') minLng: string,
        @Query('maxLng') maxLng: string,
    ) {
        if (!minLat || !maxLat || !minLng || !maxLng) {
            return [];
        }

        const bounds = {
            minLat: parseFloat(minLat),
            maxLat: parseFloat(maxLat),
            minLng: parseFloat(minLng),
            maxLng: parseFloat(maxLng),
        };

        if (isNaN(bounds.minLat) || isNaN(bounds.maxLat) || isNaN(bounds.minLng) || isNaN(bounds.maxLng)) {
            return [];
        }

        return this.serviceRequestsService.findInBoundingBox(bounds);
    }
}
