import { Injectable, Logger } from '@nestjs/common';
import { ChatGateway } from '../../chat/chat.gateway';
import {
    ServiceRequestNotificationPayload,
    ServiceRequestAcceptedPayload,
    ServiceRequestClosedPayload,
    ServiceRequestExpiredPayload,
    ServiceRequestNoProvidersPayload,
} from './notification.interface';

/**
 * NotificationService abstracts notification delivery across channels
 * Decouples business logic from WebSocket implementation for better testability
 */
@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(private readonly chatGateway: ChatGateway) {}

    /**
     * Notify providers about a new service request opportunity
     */
    async notifyProvidersNewRequest(requestId: string, providerIds: string[], payload: ServiceRequestNotificationPayload): Promise<void> {
        if (!providerIds || providerIds.length === 0) {
            this.logger.warn(`No providers to notify for request ${requestId}`);
            return;
        }

        for (const providerId of providerIds) {
            try {
                this.chatGateway.server.to(`user-${providerId}`).emit('service-request-new-opportunity', payload);

                this.logger.debug(`Notified provider ${providerId} about request ${requestId} at distance ${payload.distanceKm}km`);
            } catch (error) {
                this.logger.error(`Failed to notify provider ${providerId} for request ${requestId}:`, error);
            }
        }

        this.logger.log(`Notified ${providerIds.length} providers about new request ${requestId}`);
    }

    /**
     * Notify seeker that their request has been accepted
     */
    async notifySeekerAccepted(seekerId: string, payload: ServiceRequestAcceptedPayload): Promise<void> {
        try {
            this.chatGateway.server.to(`user-${seekerId}`).emit('service-request-accepted', payload);

            this.logger.log(`Notified seeker ${seekerId} that request ${payload.requestId} was accepted`);
        } catch (error) {
            this.logger.error(`Failed to notify seeker ${seekerId} about acceptance:`, error);
        }
    }

    /**
     * Notify providers that a request has been closed
     */
    async notifyProvidersClosed(providerIds: string[], requestId: string, reason: 'expired' | 'cancelled' | 'accepted_by_another'): Promise<void> {
        if (!providerIds || providerIds.length === 0) {
            return;
        }

        const payload: ServiceRequestClosedPayload = { requestId, reason };

        for (const providerId of providerIds) {
            try {
                this.chatGateway.server.to(`user-${providerId}`).emit('service-request-closed', payload);
            } catch (error) {
                this.logger.error(`Failed to notify provider ${providerId} about closure:`, error);
            }
        }

        this.logger.log(`Notified ${providerIds.length} providers that request ${requestId} was closed (${reason})`);
    }

    /**
     * Notify seeker that no providers are available
     */
    async notifySeekerNoProviders(seekerId: string, requestId: string): Promise<void> {
        const payload: ServiceRequestNoProvidersPayload = {
            requestId,
            message: 'Unfortunately, no service providers are available in your area for this request.',
        };

        try {
            this.chatGateway.server.to(`user-${seekerId}`).emit('service-request-no-providers', payload);

            this.logger.log(`Notified seeker ${seekerId} that no providers available for request ${requestId}`);
        } catch (error) {
            this.logger.error(`Failed to notify seeker ${seekerId} about no providers:`, error);
        }
    }

    /**
     * Notify seeker that their request has expired
     */
    async notifySeekerExpired(seekerId: string, requestId: string): Promise<void> {
        const payload: ServiceRequestExpiredPayload = {
            requestId,
            message: 'Your service request has expired. Please create a new request if you still need the service.',
        };

        try {
            this.chatGateway.server.to(`user-${seekerId}`).emit('service-request-expired', payload);

            this.logger.log(`Notified seeker ${seekerId} that request ${requestId} expired`);
        } catch (error) {
            this.logger.error(`Failed to notify seeker ${seekerId} about expiration:`, error);
        }
    }
}
