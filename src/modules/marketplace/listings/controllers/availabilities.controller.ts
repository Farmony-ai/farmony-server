import { Controller, Post, Get, Patch, Delete, Param, Body } from '@nestjs/common';
import { AvailabilitiesService } from '../services/availabilities.service';
import { CreateAvailabilityDto } from '../dto/create-availability.dto';
import { UpdateAvailabilityDto } from '../dto/update-availability.dto';

@Controller('availabilities')
export class AvailabilitiesController {
    constructor(private readonly svc: AvailabilitiesService) {}

    @Post()
    create(@Body() dto: CreateAvailabilityDto) {
        return this.svc.create(dto);
    }

    @Get('listing/:listingId')
    findByListing(@Param('listingId') listingId: string) {
        return this.svc.findByListing(listingId);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateAvailabilityDto) {
        return this.svc.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.svc.delete(id);
    }
}
