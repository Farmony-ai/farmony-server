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

            // Get average rating
            // TODO: Ratings will be implemented in engagement/ratings module
            const ratings = [];
            const avgRating = 0;

            // Get all bookings/orders
            const allBookings = await this.ordersService.findByProvider(providerId);

            // Get available service requests for provider
            const availableRequests = await this.getAvailableServiceRequests(providerId);

            // Get accepted service requests (orders from service requests)
            const acceptedRequests = await this.getAcceptedServiceRequests(providerId);

            // Manually fetch and enhance booking data
            const enhancedBookings = await Promise.all(
                allBookings.map(async (booking) => {
                    let seekerDetails = null;
                    let listingDetails = null;
                    let serviceRequestDetails = null;

                    try {
                        // Fetch seeker details
                        seekerDetails = await this.usersService.findById(booking.seekerId.toString());
                    } catch (error) {
                        console.error(`Failed to fetch seeker ${booking.seekerId}:`, error);
                    }

                    // Check if this is from a service request or direct booking
                    if ((booking as any).serviceRequestId) {
                        try {
                            serviceRequestDetails = await this.serviceRequestsService.findById((booking as any).serviceRequestId);
                        } catch (error) {
                            console.error(`Failed to fetch service request:`, error);
                        }
                    }

                    if (booking.listingId) {
                        try {
                            listingDetails = await this.listingsService.findById(booking.listingId.toString());
                        } catch (error) {
                            console.error(`Failed to fetch listing ${booking.listingId}:`, error);
                        }
                    }

                    const enhanced = {
                        ...((booking as any).toObject ? (booking as any).toObject() : booking),
                        seekerDetails,
                        listingDetails,
                        serviceRequestDetails,
                        isServiceRequest: !!(booking as any).serviceRequestId,
                    };
                    return enhanced;
                })
            );

            // Process and enhance bookings with distance calculation
            const enhanceBooking = (booking: any) => {
                const enhanced = {
                    _id: booking._id,
                    status: booking.status,
                    orderType: booking.orderType,
                    createdAt: booking.createdAt,
                    requestExpiresAt: booking.requestExpiresAt,
                    serviceStartDate: booking.serviceStartDate,
                    serviceEndDate: booking.serviceEndDate,
                    quantity: booking.quantity,
                    unitOfMeasure: booking.unitOfMeasure,
                    totalAmount: booking.totalAmount,
                    isAutoRejected: booking.isAutoRejected,
                    coordinates: booking.coordinates,
                    isServiceRequest: booking.isServiceRequest,

                    // Seeker details
                    seeker: {
                        _id: booking.seekerDetails?._id || booking.seekerId,
                        name: booking.seekerDetails?.name || 'Unknown',
                        phone: booking.seekerDetails?.phone || '',
                        email: booking.seekerDetails?.email || '',
                        location:
                            booking.seekerDetails?.address?.village || booking.seekerDetails?.address?.city || booking.seekerDetails?.address?.district || 'Location not available',
                        coordinates: booking.seekerDetails?.coordinates || booking.seekerDetails?.address?.coordinates || null,
                    },

                    // Listing details with correct field names
                    listing: booking.listingDetails
                        ? {
                            _id: booking.listingDetails?._id || booking.listingId,
                            title: booking.listingDetails?.title || 'Service',
                            description: booking.listingDetails?.description || '',
                            price: booking.listingDetails?.price || booking.totalAmount,
                            unitOfMeasure: booking.listingDetails?.unitOfMeasure || booking.unitOfMeasure,
                            category: booking.listingDetails?.category || '',
                            images: booking.listingDetails?.photoUrls || [],
                            thumbnailUrl: booking.listingDetails?.photoUrls?.[0] || null,
                        }
                        : null,

                    // Service request details if applicable
                    serviceRequest: booking.serviceRequestDetails
                        ? {
                            title: booking.serviceRequestDetails.title,
                            description: booking.serviceRequestDetails.description,
                            address: booking.serviceRequestDetails.address,
                            metadata: booking.serviceRequestDetails.metadata,
                        }
                        : null,

                    // Distance calculation
                    distance: null as number | null,
                };

                // Calculate distance if coordinates available
                if (providerCoordinates && booking.coordinates && booking.coordinates.length === 2) {
                    try {
                        enhanced.distance = this.calculateDistance(
                            providerCoordinates[1], // lat
                            providerCoordinates[0], // lon
                            booking.coordinates[1],
                            booking.coordinates[0]
                        );
                    } catch (error) {
                        console.error('Distance calculation error:', error);
                    }
                }

                return enhanced;
            };

            // Separate and enhance bookings by status
            const pendingBookings = enhancedBookings
                .filter((b) => b.status === 'pending')
                .map(enhanceBooking)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10);

            const upcomingBookings = enhancedBookings
                .filter((b) => ['accepted', 'paid'].includes(b.status))
                .map(enhanceBooking)
                .sort((a, b) => {
                    const dateA = a.serviceStartDate || a.createdAt;
                    const dateB = b.serviceStartDate || b.createdAt;
                    return new Date(dateA).getTime() - new Date(dateB).getTime();
                })
                .slice(0, 10);

            return {
                summary: {
                    totalBookings: summary.totalOrders,
                    completedBookings: summary.fulfilledOrders,
                    revenue: summary.revenue,
                    activeListings,
                    averageRating: Number(avgRating.toFixed(1)),
                    totalRatings: ratings.length,
                    availableServiceRequests: availableRequests.length,
                },
                pendingBookings,
                upcomingBookings,
                recentBookings: [...pendingBookings, ...upcomingBookings].slice(0, 5),
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
                }).slice(0, 5), // Top 5 available requests
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
            // 2. Category AND subcategory match provider's listings
            const relevantRequests = result.requests.filter((request: any) => {
                // Check if provider was notified (check both legacy and lifecycle fields)
                const legacyNotified = request.allNotifiedProviders?.some((pid: any) => pid.toString() === providerId);
                const lifecycleNotified = request.lifecycle?.matching?.allNotifiedProviders?.some((pid: any) => pid.toString() === providerId);

                const wasNotified = legacyNotified || lifecycleNotified;

                if (!wasNotified) return false;

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
