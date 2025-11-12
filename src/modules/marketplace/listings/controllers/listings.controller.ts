// src/modules/marketplace/listings/controllers/listings.controller.ts
import { Controller, Post, Get, Patch, Delete, Param, Body, UseInterceptors, UploadedFiles, Query, UseGuards, Request } from '@nestjs/common';
import { ListingsService } from '../services/listings.service';
import { CreateListingDto } from '../dto/create-listing.dto';
import { UpdateListingDto } from '../dto/update-listing.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { OptionalAuthGuard } from '@identity/guards/optional-auth.guard';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
    constructor(private readonly svc: ListingsService) {}

    @Post()
    @UseInterceptors(FilesInterceptor('photos', 10))
    async create(@UploadedFiles() files: Array<Express.Multer.File>, @Body('data') dataString: string) {
        console.log('Received files:', files?.length || 0);

        // Parse JSON data
        const listingData = JSON.parse(dataString);

        const dto: CreateListingDto = {
            ...listingData,
        };

        console.log('CreateListingDto:', dto);
        return this.svc.create(dto, files);
    }

    @Get()
    @UseGuards(OptionalAuthGuard)
    async findAll(@Request() req, @Query() filters?: any) {
        try {
            console.log('ListingsController.findAll - Received filters:', filters);
            console.log('ListingsController.findAll - Current user:', req.user?.userId);

            // Map app-specific fields to standard filters if needed
            const mappedFilters: any = { ...filters };

            // Add current user ID to exclude their own listings (only if authenticated)
            if (req.user?.userId) {
                mappedFilters.excludeProviderId = req.user.userId;
            }

            // Map 'text' to 'searchText' if needed
            if (filters?.text && !filters?.searchText) {
                mappedFilters.searchText = filters.text;
            }

            // Map latitude/longitude to coordinates if needed
            if (filters?.latitude && filters?.longitude && !filters?.coordinates) {
                mappedFilters.coordinates = [parseFloat(filters.longitude), parseFloat(filters.latitude)];
            }

            // Map 'radius' to 'distance' if needed
            if (filters?.radius && !filters?.distance) {
                mappedFilters.distance = filters.radius;
            }

            return await this.svc.findAll(mappedFilters);
        } catch (error) {
            console.error('ListingsController.findAll - Error:', error);
            throw error;
        }
    }

    @Get('search')
    @UseGuards(OptionalAuthGuard)
    async search(@Request() req, @Query() filters: any) {
        try {
            console.log('ListingsController.search - Received filters:', filters);
            console.log('ListingsController.search - Current user:', req.user?.userId);

            // Map app-specific fields to standard filters
            const mappedFilters: any = { ...filters };

            // Add current user ID to exclude their own listings (only if authenticated)
            if (req.user?.userId) {
                mappedFilters.excludeProviderId = req.user.userId;
            }

            // Map 'text' to 'searchText'
            if (filters.text && !filters.searchText) {
                mappedFilters.searchText = filters.text;
            }

            // Map latitude/longitude to coordinates
            if (filters.latitude && filters.longitude) {
                mappedFilters.coordinates = [parseFloat(filters.longitude), parseFloat(filters.latitude)];
            }

            // Map 'radius' to 'distance'
            if (filters.radius && !filters.distance) {
                mappedFilters.distance = filters.radius;
            }

            console.log('ListingsController.search - Mapped filters:', mappedFilters);

            // Dedicated search endpoint - uses the same service method as findAll
            return await this.svc.findAll(mappedFilters);
        } catch (error) {
            console.error('ListingsController.search - Error:', error);
            throw error;
        }
    }

    @Get('nearby')
    @UseGuards(OptionalAuthGuard)
    findNearby(@Request() req, @Query('lat') lat: string, @Query('lng') lng: string, @Query('distance') distance: string) {
        const coordinates = [parseFloat(lng), parseFloat(lat)];
        const maxDistance = parseFloat(distance) || 10; // Default 10km
        const excludeProviderId = req.user?.userId || undefined;
        return this.svc.findNearby(coordinates, maxDistance, excludeProviderId);
    }

    @Get('public')
    async findAllPublic(@Query() filters?: any) {
        try {
            console.log('ListingsController.findAllPublic - Received filters:', filters);

            // Map app-specific fields to standard filters if needed
            const mappedFilters: any = { ...filters };

            // Map 'text' to 'searchText' if needed
            if (filters?.text && !filters?.searchText) {
                mappedFilters.searchText = filters.text;
            }

            // Map latitude/longitude to coordinates if needed
            if (filters?.latitude && filters?.longitude && !filters?.coordinates) {
                mappedFilters.coordinates = [parseFloat(filters.longitude), parseFloat(filters.latitude)];
            }

            // Map 'radius' to 'distance' if needed
            if (filters?.radius && !filters?.distance) {
                mappedFilters.distance = filters.radius;
            }

            // Don't exclude any provider for public access
            return await this.svc.findAll(mappedFilters);
        } catch (error) {
            console.error('ListingsController.findAllPublic - Error:', error);
            throw error;
        }
    }

    @Get('provider/:providerId')
    findByProvider(@Param('providerId') providerId: string) {
        return this.svc.findByProvider(providerId);
    }

    // ⚠️ REMOVED: refresh-urls endpoint is no longer needed!
    // URLs from CloudFront never expire

    // @Post(':id/refresh-urls')  // <-- DELETE THIS
    // refreshUrls(@Param('id') id: string) {
    //   return this.svc.refreshUrls(id);
    // }

    // This should be the LAST GET route as it matches any string
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.svc.findById(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateListingDto) {
        return this.svc.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.svc.delete(id);
    }
}
