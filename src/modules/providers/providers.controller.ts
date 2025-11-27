import { Controller, Get, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { UpdatePreferencesDto } from '../users/dto/update-preferences.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Providers')
@Controller('providers')
@UseGuards(AuthGuard('jwt'))
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get(':providerId/dashboard')
  @ApiOperation({ summary: 'Get provider dashboard with all stats' })
  getDashboard(@Param('providerId') providerId: string) {
    return this.providersService.getProviderDashboard(providerId);
  }

  @Get(':providerId/bookings')
  @ApiOperation({ summary: 'Get all provider bookings' })
  getBookings(@Param('providerId') providerId: string) {
    return this.providersService.getProviderBookings(providerId);
  }

  @Get(':providerId/bookings/active')
  @ApiOperation({ summary: 'Get active bookings' })
  getActiveBookings(@Param('providerId') providerId: string) {
    return this.providersService.getActiveBookings(providerId);
  }

  @Get(':providerId/bookings/completed')
  @ApiOperation({ summary: 'Get completed bookings' })
  getCompletedBookings(@Param('providerId') providerId: string) {
    return this.providersService.getCompletedBookings(providerId);
  }

  @Get(':providerId/bookings/to-review')
  @ApiOperation({ summary: 'Get bookings needing review' })
  getBookingsToReview(@Param('providerId') providerId: string) {
    return this.providersService.getBookingsToReview(providerId);
  }

  @Get(':providerId/service-requests')
  @ApiOperation({ summary: 'Get available service requests for provider' })
  getAvailableServiceRequests(@Param('providerId') providerId: string) {
    return this.providersService.getAvailableServiceRequests(providerId);
  }

  @Get(':providerId/service-requests/accepted')
  @ApiOperation({ summary: 'Get accepted service requests' })
  getAcceptedServiceRequests(@Param('providerId') providerId: string) {
    return this.providersService.getAcceptedServiceRequests(providerId);
  }

  @Get(':providerId/service-requests/stats')
  @ApiOperation({ summary: 'Get service request statistics' })
  getServiceRequestStats(@Param('providerId') providerId: string) {
    return this.providersService.getServiceRequestStats(providerId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update provider preferences' })
  updatePreferences(@Request() req, @Body() dto: UpdatePreferencesDto) {
    const userId = req.user.userId || req.user.sub;
    return this.providersService.updateUserPreferences(userId, dto);
  }
}