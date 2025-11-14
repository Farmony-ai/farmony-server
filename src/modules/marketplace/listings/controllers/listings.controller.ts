// src/modules/marketplace/listings/controllers/listings.controller.ts
import { Controller, Post, Get, Patch, Delete, Param, Body, UseInterceptors, UploadedFiles, UseGuards, Request } from '@nestjs/common';
import { ListingsService } from '../services/listings.service';
import { CreateListingDto } from '../dto/create-listing.dto';
import { UpdateListingDto } from '../dto/update-listing.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from '@identity/guards/firebase-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
    constructor(private readonly svc: ListingsService) {}

    @Post()
    @UseGuards(FirebaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new listing (providers only)' })
    @UseInterceptors(FilesInterceptor('photos', 10))
    async create(@UploadedFiles() files: Array<Express.Multer.File>, @Body('data') dataString: string, @Request() req: any) {
        console.log('Received files:', files?.length || 0);

        // Parse JSON data
        const listingData = JSON.parse(dataString);

        const dto: CreateListingDto = {
            ...listingData,
        };

        console.log('CreateListingDto:', dto);
        return this.svc.create(dto, files);
    }

    // NOTE: Manual search/browse endpoints removed - not in MVP scope
    // MVP uses wave-based matching instead of seeker-initiated search
    // See docs/01-project-scope.md Section 2.3

    @Get('provider/:providerId')
    @ApiOperation({ summary: 'View listings from a specific provider (after match)' })
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
    @ApiOperation({ summary: 'View a specific listing by ID' })
    findOne(@Param('id') id: string) {
        return this.svc.findById(id);
    }

    @Patch(':id')
    @UseGuards(FirebaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a listing (providers only)' })
    update(@Param('id') id: string, @Body() dto: UpdateListingDto, @Request() req: any) {
        return this.svc.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(FirebaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a listing (providers only)' })
    remove(@Param('id') id: string, @Request() req: any) {
        return this.svc.delete(id);
    }
}
