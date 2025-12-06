// src/modules/providers/providers.service.ts
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { OrdersService } from '../../transactions/service-requests/services/orders.service';
import { ListingsService } from '../../marketplace/listings/services/listings.service';
import { Types } from 'mongoose';
import { UsersService } from '../../identity/services/users.service';
import { ServiceRequestsService } from '../../transactions/service-requests/services/service-requests.service';
import { UpdatePreferencesDto } from '../../identity/dto/update-preferences.dto';
import { ServiceRequestStatus } from '../../transactions/service-requests/schemas/service-request.entity';

@Injectable()
export class ProvidersService {
    constructor(
        private readonly ordersService: OrdersService,
        private readonly listingsService: ListingsService,
        private readonly usersService: UsersService,
        @Inject(forwardRef(() => ServiceRequestsService))
        private readonly serviceRequestsService: ServiceRequestsService
    ) { }

    // Helper function to calculate distance between coordinates
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10; // Round to 1 decimal place
    }

    async getProviderDashboard(providerId: string) {
        try {
            // Get provider details for location
            const provider = await this.usersService.findById(providerId);
            const providerCoordinates = (provider as any)?.coordinates || (provider as any)?.address?.coordinates || null;

            // Get summary statistics
            const summary = await this.ordersService.getProviderSummary(providerId);

            // Get active listings count
            const listings = await this.listingsService.findByProvider(providerId);
            const activeListings = listings.filter((l) => l.isActive).length;

            // Get available service requests for provider
            const availableRequests = await this.getAvailableServiceRequests(providerId);

            // Get accepted service requests (orders from service requests)
            const acceptedRequests = await this.getAcceptedServiceRequests(providerId);

            // Remove logic for pendingBookings, upcomingBookings, recentBookings

            return {
                summary: {
                    totalBookings: summary.totalOrders,
                    completedBookings: summary.fulfilledOrders,
                    revenue: summary.revenue,
                    activeListings,
                    averageRating: 0, // Placeholder as ratings module is TODO
                    totalRatings: 0, // Placeholder
                    availableServiceRequests: availableRequests.length,
                },
                availableServiceRequests: availableRequests.map(req => {
                    let distance = null;
                    if (providerCoordinates && req.location?.coordinates) {
                        try {
                            distance = this.calculateDistance(
                                providerCoordinates[1], providerCoordinates[0],
                                req.location.coordinates[1], req.location.coordinates[0]
                            );
                        } catch (e) { }
                    }
                    return { ...req, distance };
                }),
                activeServiceRequests: acceptedRequests.slice(0, 5), // Top 5 accepted requests
            };
        } catch (error) {
            console.error('Error in getProviderDashboard:', error);
            throw error;
        }
    }

    async getProviderBookings(providerId: string) {
        const bookings = await this.ordersService.findByProvider(providerId);

        // Separate service request orders from direct bookings
        const serviceRequestOrders = bookings.filter((b) => (b as any).serviceRequestId);
        const directBookings = bookings.filter((b) => !(b as any).serviceRequestId);

        return {
            active: bookings.filter((b) => ['pending', 'accepted', 'paid'].includes(b.status)),
            completed: bookings.filter((b) => b.status === 'completed'),
            canceled: bookings.filter((b) => b.status === 'canceled'),
            toReview: await this.getBookingsNeedingReview(providerId, bookings),
            serviceRequestOrders: serviceRequestOrders.length,
            directBookings: directBookings.length,
        };
    }

    async getActiveBookings(providerId: string) {
        const bookings = await this.ordersService.findByProvider(providerId);
        return bookings.filter((b) => ['pending', 'accepted', 'paid'].includes(b.status));
    }

    async getCompletedBookings(providerId: string) {
        const bookings = await this.ordersService.findByProvider(providerId);
        return bookings.filter((b) => b.status === 'completed');
    }

    async getBookingsToReview(providerId: string) {
        const completedBookings = await this.getCompletedBookings(providerId);
        return this.getBookingsNeedingReview(providerId, completedBookings);
    }

    private async getBookingsNeedingReview(providerId: string, bookings: any[]) {
        // TODO: Ratings will be implemented in engagement/ratings module
        // For now, return empty array
        return [];
    }

    async updateUserPreferences(userId: string, dto: UpdatePreferencesDto) {
        return this.usersService.updatePreferences(userId, dto);
    }

    // New methods for service requests
    async getAvailableServiceRequests(providerId: string): Promise<any[]> {
        try {
            // Get provider's active listings to determine categories and subcategories
            const listings = await this.listingsService.findByProvider(providerId);
            const activeListings = listings.filter((l) => l.isActive);

            if (activeListings.length === 0) {
                return [];
            }

            // Build a map of category -> subcategories the provider services
            const serviceMap = new Map<string, Set<string>>();

            for (const listing of activeListings) {
                const categoryId = listing.categoryId?._id?.toString() || listing.categoryId?.toString();
                const subCategoryId = listing.subCategoryId?._id?.toString() || listing.subCategoryId?.toString();

                if (categoryId) {
                    if (!serviceMap.has(categoryId)) {
                        serviceMap.set(categoryId, new Set());
                    }
                    if (subCategoryId) {
                        serviceMap.get(categoryId).add(subCategoryId);
                    }
                }
            }

            // Get all matched service requests
            const result = await this.serviceRequestsService.findAll({
                status: ServiceRequestStatus.MATCHED,
                page: 1,
                limit: 100,
            });

            // Filter requests where:
            // 1. Provider was notified
            // 2. Provider has NOT declined
            // 3. Category AND subcategory match provider's listings
            const relevantRequests = result.requests.filter((request: any) => {
                // Check if provider was notified (check both legacy and lifecycle fields)
                const legacyNotified = request.allNotifiedProviders?.some((pid: any) => pid.toString() === providerId);
                const lifecycleNotified = request.lifecycle?.matching?.allNotifiedProviders?.some((pid: any) => pid.toString() === providerId);

                const wasNotified = legacyNotified || lifecycleNotified;

                if (!wasNotified) return false;

                // Check if provider has declined this request
                const legacyDeclined = request.declinedProviders?.some((pid: any) => pid.toString() === providerId);
                const lifecycleDeclined = request.lifecycle?.matching?.declinedProviders?.some((pid: any) => pid.toString() === providerId);

                if (legacyDeclined || lifecycleDeclined) return false;

                // Check if request is expired
                if (new Date(request.expiresAt) <= new Date()) return false;

                // Check if category matches
                const requestCategoryId = request.categoryId?._id?.toString() || request.categoryId?.toString();
                if (!serviceMap.has(requestCategoryId)) return false;

                // Check if subcategory matches (if specified in request)
                if (request.subCategoryId) {
                    const requestSubCategoryId = request.subCategoryId?._id?.toString() || request.subCategoryId?.toString();
                    const providerSubCategories = serviceMap.get(requestCategoryId);

                    // Provider must service this specific subcategory
                    if (!providerSubCategories.has(requestSubCategoryId)) {
                        return false;
                    }
                }

                return true;
            });

            // Sort by urgency (serviceStartDate) and creation date
            return relevantRequests.sort((a, b) => {
                const dateA = new Date(a.serviceStartDate).getTime();
                const dateB = new Date(b.serviceStartDate).getTime();
                return dateA - dateB;
            });
        } catch (error) {
            console.error('Error getting available service requests:', error);
            return [];
        }
    }

    async getAcceptedServiceRequests(providerId: string): Promise<any[]> {
        try {
            // Get orders that originated from service requests
            const orders = await this.ordersService.findByProvider(providerId);
            const serviceRequestOrders = orders.filter((o) => (o as any).serviceRequestId);

            // Enhance with service request details
            const enhanced = await Promise.all(
                serviceRequestOrders.map(async (order) => {
                    try {
                        const requestDetails = await this.serviceRequestsService.findById((order as any).serviceRequestId);
                        return {
                            ...order,
                            serviceRequest: requestDetails,
                        };
                    } catch (error) {
                        return order;
                    }
                })
            );

            return enhanced;
        } catch (error) {
            console.error('Error getting accepted service requests:', error);
            return [];
        }
    }

    async getServiceRequestStats(providerId: string): Promise<{
        totalNotified: number;
        totalAccepted: number;
        totalDeclined: number;
        acceptanceRate: number;
    }> {
        try {
            // This would require tracking in the service request module
            // For now, return basic stats based on orders
            const orders = await this.ordersService.findByProvider(providerId);
            const serviceRequestOrders = orders.filter((o) => (o as any).serviceRequestId);

            return {
                totalNotified: 0, // Would need to query service requests
                totalAccepted: serviceRequestOrders.length,
                totalDeclined: 0, // Would need to track declines
                acceptanceRate: 0, // Calculate when we have the data
            };
        } catch (error) {
            console.error('Error getting service request stats:', error);
            return {
                totalNotified: 0,
                totalAccepted: 0,
                totalDeclined: 0,
                acceptanceRate: 0,
            };
        }
    }
}
