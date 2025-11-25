import { Injectable, Logger } from '@nestjs/common';
import { FirebaseAdminService } from '../../../common/firebase/firebase-admin.service';
import { FcmTokenService } from '../../../identity/services/fcm-token.service';
import {
    ServiceRequestNotificationPayload,
    ServiceRequestAcceptedPayload,
    ServiceRequestClosedPayload,
    ServiceRequestExpiredPayload,
    ServiceRequestNoProvidersPayload,
} from '../notification.interface';

/**
 * NotificationService handles all push notification logic using Firebase Cloud Messaging (FCM)
 *
 * According to the documented architecture (CLAUDE.md), the system uses:
 * 1. REST API for data operations
 * 2. Client polling for status updates
 * 3. Firebase Cloud Messaging (FCM) for push notifications (this service)
 *
 * This service sends real FCM push notifications to users' devices.
 * FCM tokens are stored in User.fcmTokens[] array.
 */
@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly firebaseAdmin: FirebaseAdminService,
        private readonly fcmTokenService: FcmTokenService,
    ) {}

    /**
     * Notify providers about a new service request opportunity using FCM
     */
    async notifyProvidersNewRequest(requestId: string, providerIds: string[], payload: ServiceRequestNotificationPayload): Promise<void> {
        if (!providerIds || providerIds.length === 0) {
            this.logger.warn(`No providers to notify for request ${requestId}`);
            return;
        }

        try {
            // Get FCM tokens for all providers
            const tokenMap = await this.fcmTokenService.getTokensForUsers(providerIds);

            const allTokens: string[] = [];
            tokenMap.forEach((tokens) => {
                allTokens.push(...tokens);
            });

            if (allTokens.length === 0) {
                this.logger.warn(`No FCM tokens found for ${providerIds.length} providers`);
                return;
            }

            // Send FCM notification
            const notification = {
                title: 'New Service Request',
                body: `${payload.title} - ${payload.distanceKm}km away`,
            };

            const data = {
                type: 'service-request-new-opportunity',
                requestId: requestId,
                categoryName: payload.categoryName || '',
                distanceKm: payload.distanceKm.toString(),
            };

            await this.firebaseAdmin.sendMulticastNotification(allTokens, notification, data);

            this.logger.log(`Sent FCM notifications to ${allTokens.length} devices for ${providerIds.length} providers (request ${requestId})`);
        } catch (error) {
            this.logger.error(`Failed to send FCM notifications for request ${requestId}:`, error);
        }
    }

    /**
     * Notify seeker that their request has been accepted using FCM
     */
    async notifySeekerAccepted(seekerId: string, payload: ServiceRequestAcceptedPayload): Promise<void> {
        try {
            const tokens = await this.fcmTokenService.getTokens(seekerId);

            if (tokens.length === 0) {
                this.logger.warn(`No FCM tokens found for seeker ${seekerId}`);
                return;
            }

            const notification = {
                title: 'Request Accepted!',
                body: `Your service request has been accepted by ${payload.providerName}`,
            };

            const data = {
                type: 'service-request-accepted',
                requestId: payload.requestId,
                providerId: payload.providerId,
                providerName: payload.providerName || '',
            };

            await this.firebaseAdmin.sendMulticastNotification(tokens, notification, data);

            this.logger.log(`Notified seeker ${seekerId} that request ${payload.requestId} was accepted`);
        } catch (error) {
            this.logger.error(`Failed to notify seeker ${seekerId} about acceptance:`, error);
        }
    }

    /**
     * Notify providers that a request has been closed using FCM
     */
    async notifyProvidersClosed(providerIds: string[], requestId: string, reason: 'expired' | 'cancelled' | 'accepted_by_another'): Promise<void> {
        if (!providerIds || providerIds.length === 0) {
            return;
        }

        try {
            const tokenMap = await this.fcmTokenService.getTokensForUsers(providerIds);

            const allTokens: string[] = [];
            tokenMap.forEach((tokens) => {
                allTokens.push(...tokens);
            });

            if (allTokens.length === 0) {
                this.logger.warn(`No FCM tokens found for ${providerIds.length} providers`);
                return;
            }

            const reasonMessages = {
                expired: 'The service request has expired',
                cancelled: 'The service request was cancelled',
                accepted_by_another: 'Another provider accepted this request',
            };

            const notification = {
                title: 'Request Closed',
                body: reasonMessages[reason],
            };

            const data = {
                type: 'service-request-closed',
                requestId: requestId,
                reason: reason,
            };

            await this.firebaseAdmin.sendMulticastNotification(allTokens, notification, data);

            this.logger.log(`Notified ${allTokens.length} devices for ${providerIds.length} providers that request ${requestId} was closed (${reason})`);
        } catch (error) {
            this.logger.error(`Failed to notify providers about closure of request ${requestId}:`, error);
        }
    }

    /**
     * Notify seeker that no providers are available using FCM
     */
    async notifySeekerNoProviders(seekerId: string, requestId: string): Promise<void> {
        try {
            const tokens = await this.fcmTokenService.getTokens(seekerId);

            if (tokens.length === 0) {
                this.logger.warn(`No FCM tokens found for seeker ${seekerId}`);
                return;
            }

            const notification = {
                title: 'No Providers Available',
                body: 'Unfortunately, no service providers are available in your area for this request',
            };

            const data = {
                type: 'service-request-no-providers',
                requestId: requestId,
            };

            await this.firebaseAdmin.sendMulticastNotification(tokens, notification, data);

            this.logger.log(`Notified seeker ${seekerId} that no providers available for request ${requestId}`);
        } catch (error) {
            this.logger.error(`Failed to notify seeker ${seekerId} about no providers:`, error);
        }
    }

    /**
     * Notify seeker that their request has expired using FCM
     */
    async notifySeekerExpired(seekerId: string, requestId: string): Promise<void> {
        try {
            const tokens = await this.fcmTokenService.getTokens(seekerId);

            if (tokens.length === 0) {
                this.logger.warn(`No FCM tokens found for seeker ${seekerId}`);
                return;
            }

            const notification = {
                title: 'Request Expired',
                body: 'Your service request has expired without being fulfilled',
            };

            const data = {
                type: 'service-request-expired',
                requestId: requestId,
            };

            await this.firebaseAdmin.sendMulticastNotification(tokens, notification, data);

            this.logger.log(`Notified seeker ${seekerId} that request ${requestId} expired`);
        } catch (error) {
            this.logger.error(`Failed to notify seeker ${seekerId} about expiration:`, error);
        }
    }
}
