import { Injectable } from '@nestjs/common';
import { OrdersService } from '../../transactions/service-requests/services/orders.service';
import { ServiceRequestsService } from '../../transactions/service-requests/services/service-requests.service';
import { UnifiedBookingDto } from './dto/unified-booking.dto';

@Injectable()
export class SeekerService {
    constructor(private readonly ordersService: OrdersService, private readonly serviceRequestsService: ServiceRequestsService) {}

    async getUnifiedBookings(seekerId: string): Promise<UnifiedBookingDto[]> {
        // Fetch both data types in parallel
        const [orders, serviceRequestsResult] = await Promise.all([
            this.ordersService.findBySeekerPopulated(seekerId),
            this.serviceRequestsService.findAll({ seekerId, limit: 100 }),
        ]);

        // Extract service requests from paginated result
        const serviceRequests = serviceRequestsResult.requests || [];

        // Map and merge with unified structure
        const mappedOrders = orders.map((order) => this.mapOrderToUnified(order));
        const mappedRequests = serviceRequests.map((req) => this.mapServiceRequestToUnified(req));

        // Combine and sort by date (newest first)
        return [...mappedOrders, ...mappedRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    private mapOrderToUnified(order: any): UnifiedBookingDto {
        // Extract display information
        const listing = order.listingId;
        const provider = order.providerId;

        let title = 'Service';
        if (listing) {
            if (listing.subcategory?.name) {
                title = listing.subcategory.name;
            } else if (listing.title) {
                title = listing.title;
            } else if (order.serviceType) {
                title = order.serviceType;
            }
        }

        return {
            id: order._id.toString(),
            type: 'order',
            displayStatus: this.mapOrderStatus(order.status),
            originalStatus: order.status,
            title,
            description: listing?.description,
            providerName: provider?.fullName || provider?.name,
            providerPhone: provider?.phoneNumber,
            providerEmail: provider?.email,
            providerId: provider?._id?.toString(),
            serviceStartDate: order.serviceStartDate || order.scheduledDate,
            serviceEndDate: order.serviceEndDate,
            location: order.location || order.address,
            totalAmount: order.totalAmount || order.totalCost,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            category: listing?.category,
            subcategory: listing?.subcategory,
            images: listing?.photos || listing?.images,
            orderType: order.orderType,
            quantity: order.quantity,
            unitOfMeasure: order.unitOfMeasure,
        };
    }

    private mapServiceRequestToUnified(request: any): UnifiedBookingDto {
        const isSearching = request.status === 'open' || request.status === 'matched';
        const now = Date.now();
        const createdAt = new Date(request.createdAt).getTime();
        const elapsedMinutes = isSearching ? Math.floor((now - createdAt) / 60000) : null;

        // Get accepted provider info if available
        let providerName = null;
        let providerPhone = null;
        let providerEmail = null;
        let providerId = null;

        const lifecycleOrder = (request as any).lifecycle?.order;
        const populatedLifecycleProvider = lifecycleOrder?.providerId && typeof lifecycleOrder.providerId === 'object';
        if (populatedLifecycleProvider) {
            providerName = (lifecycleOrder as any).providerId.fullName || (lifecycleOrder as any).providerId.name;
            providerPhone = (lifecycleOrder as any).providerId.phoneNumber;
            providerEmail = (lifecycleOrder as any).providerId.email;
            providerId = (lifecycleOrder as any).providerId._id?.toString();
        } else if (lifecycleOrder?.providerId) {
            providerId = lifecycleOrder.providerId.toString();
        }

        return {
            id: request._id.toString(),
            type: 'service_request',
            displayStatus: this.mapServiceRequestStatus(request.status),
            originalStatus: request.status,
            title: request.title,
            description: request.description,
            providerName,
            providerPhone,
            providerEmail,
            providerId,
            serviceStartDate: request.serviceStartDate,
            serviceEndDate: request.serviceEndDate,
            location: request.location,
            totalAmount: (request as any).lifecycle?.order?.payment?.totalAmount ?? null,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            category: request.category,
            subcategory: request.subcategory,
            images: request.images,
            budget: request.budget,
            urgency: request.urgency,
            waveCount: ((request as any).lifecycle?.matching?.notificationWaves?.length) || 0,
            matchedProvidersCount: ((request as any).lifecycle?.matching?.allNotifiedProviders?.length) || 0,
            isSearching,
            searchElapsedMinutes: elapsedMinutes,
            nextWaveAt: (request as any).lifecycle?.matching?.nextWaveAt ?? request.nextWaveAt,
            expiresAt: request.expiresAt,
            orderId: ((request as any).lifecycle?.order?.orderRef)?.toString(),
        };
    }

    private mapOrderStatus(status: string): UnifiedBookingDto['displayStatus'] {
        const mapping: Record<string, UnifiedBookingDto['displayStatus']> = {
            pending: 'pending',
            accepted: 'matched',
            paid: 'in_progress',
            completed: 'completed',
            cancelled: 'cancelled',
            canceled: 'cancelled',
            rejected: 'no_accept',
        };
        return mapping[status?.toLowerCase()] || 'pending';
    }

    private mapServiceRequestStatus(status: string): UnifiedBookingDto['displayStatus'] {
        const mapping: Record<string, UnifiedBookingDto['displayStatus']> = {
            open: 'searching',
            matched: 'searching',
            accepted: 'matched',
            expired: 'no_accept',
            cancelled: 'cancelled',
            completed: 'completed',
            no_providers_available: 'no_accept',
        };
        return mapping[status?.toLowerCase()] || 'searching';
    }
}
