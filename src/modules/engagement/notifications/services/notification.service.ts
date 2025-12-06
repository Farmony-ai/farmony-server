import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FirebaseAdminService } from '../../../common/firebase/firebase-admin.service';
import { FcmTokenService } from '../../../identity/services/fcm-token.service';
import { User, UserDocument } from '../../../identity/schemas/users.schema';
import {
    Notification,
    NotificationDocument,
    NotificationType,
    NotificationTargetType,
} from '../schemas/notification.schema';
import {
    ServiceRequestNotificationPayload,
    ServiceRequestAcceptedPayload,
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
        @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) {}

    // ==================== Preference Checking ====================

    /**
     * Check if user has enabled notifications for a specific type
     */
    private async shouldSendPushNotification(userId: string, notificationType: NotificationType): Promise<boolean> {
        try {
            const user = await this.userModel.findById(userId).select('preferences').lean().exec();
            if (!user) return true; // Default to sending if user not found

            const prefs = user.preferences;
            if (!prefs?.notificationsEnabled) return false; // Master toggle off

            const notifPrefs = prefs.notificationPreferences;
            if (!notifPrefs) return true; // Default to sending if no specific prefs

            switch (notificationType) {
                case NotificationType.SERVICE_REQUEST_ACCEPTED:
                case NotificationType.SERVICE_REQUEST_EXPIRED:
                case NotificationType.SERVICE_REQUEST_NO_PROVIDERS:
                    return notifPrefs.serviceRequestUpdates !== false;

                case NotificationType.SERVICE_REQUEST_NEW_OPPORTUNITY:
                case NotificationType.SERVICE_REQUEST_CLOSED:
                    return notifPrefs.newOpportunities !== false;

                case NotificationType.ORDER_IN_PROGRESS:
                case NotificationType.ORDER_COMPLETED:
                    return notifPrefs.orderStatusUpdates !== false;

                case NotificationType.PAYMENT_RECEIVED:
                    return notifPrefs.paymentUpdates !== false;

                case NotificationType.NEW_REVIEW:
                    return notifPrefs.reviewUpdates !== false;

                default:
                    return true;
            }
        } catch (error) {
            this.logger.warn(`Failed to check notification preferences for user ${userId}:`, error);
            return true; // Default to sending on error
        }
    }

    // ==================== Persistence Methods ====================

    /**
     * Save notification to database
     */
    private async saveNotification(params: {
        userId: string;
        type: NotificationType;
        title: string;
        body: string;
        imageUrl?: string;
        targetType?: NotificationTargetType;
        targetId?: string;
        metadata?: Record<string, any>;
    }): Promise<NotificationDocument> {
        const notification = new this.notificationModel({
            userId: new Types.ObjectId(params.userId),
            type: params.type,
            title: params.title,
            body: params.body,
            imageUrl: params.imageUrl,
            targetType: params.targetType,
            targetId: params.targetId,
            metadata: params.metadata,
            isRead: false,
        });
        return notification.save();
    }

    /**
     * Get user notifications with pagination
     */
    async getUserNotifications(userId: string, options: { page: number; limit: number; unreadOnly: boolean }) {
        const { page, limit, unreadOnly } = options;
        const skip = (page - 1) * limit;

        const query: any = { userId: new Types.ObjectId(userId) };
        if (unreadOnly) {
            query.isRead = false;
        }

        const [notifications, total] = await Promise.all([
            this.notificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
            this.notificationModel.countDocuments(query).exec(),
        ]);

        return {
            notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + notifications.length < total,
            },
        };
    }

    /**
     * Get unread notification count
     */
    async getUnreadCount(userId: string): Promise<{ count: number }> {
        const count = await this.notificationModel
            .countDocuments({ userId: new Types.ObjectId(userId), isRead: false })
            .exec();
        return { count };
    }

    /**
     * Mark single notification as read
     */
    async markAsRead(userId: string, notificationId: string): Promise<NotificationDocument | null> {
        return this.notificationModel
            .findOneAndUpdate(
                { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
                { $set: { isRead: true, readAt: new Date() } },
                { new: true },
            )
            .exec();
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
        const result = await this.notificationModel
            .updateMany({ userId: new Types.ObjectId(userId), isRead: false }, { $set: { isRead: true, readAt: new Date() } })
            .exec();
        return { modifiedCount: result.modifiedCount };
    }

    // ==================== FCM Push Notification Methods ====================

    /**
     * Notify providers about a new service request opportunity using FCM
     */
    async notifyProvidersNewRequest(requestId: string, providerIds: string[], payload: ServiceRequestNotificationPayload): Promise<void> {
        if (!providerIds || providerIds.length === 0) {
            this.logger.warn(`No providers to notify for request ${requestId}`);
            return;
        }

        const title = 'New Service Request';
        const body = `${payload.title} - ${payload.distanceKm}km away`;

        // Save notification for each provider
        for (const providerId of providerIds) {
            try {
                await this.saveNotification({
                    userId: providerId,
                    type: NotificationType.SERVICE_REQUEST_NEW_OPPORTUNITY,
                    title,
                    body,
                    targetType: NotificationTargetType.SERVICE_REQUEST,
                    targetId: requestId,
                    metadata: {
                        categoryName: payload.categoryName,
                        subCategoryName: payload.subCategoryName,
                        distanceKm: payload.distanceKm,
                        serviceStartDate: payload.serviceStartDate,
                        serviceEndDate: payload.serviceEndDate,
                    },
                });
            } catch (error) {
                this.logger.error(`Failed to save notification for provider ${providerId}:`, error);
            }
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
            const notification = { title, body };

            const data = {
                type: 'service-request-new-opportunity',
                requestId: requestId,
                categoryName: payload.categoryName || '',
                distanceKm: payload.distanceKm.toString(),
            };

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(allTokens, notification, data);

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }

            this.logger.log(`Sent FCM notifications to ${allTokens.length} devices for ${providerIds.length} providers (request ${requestId})`);
        } catch (error) {
            this.logger.error(`Failed to send FCM notifications for request ${requestId}:`, error);
        }
    }

    /**
     * Notify seeker that their request has been accepted using FCM
     */
    async notifySeekerAccepted(seekerId: string, payload: ServiceRequestAcceptedPayload): Promise<void> {
        const title = 'Request Accepted!';
        const body = `Your service request has been accepted by ${payload.providerName}`;

        // Save to database FIRST
        try {
            await this.saveNotification({
                userId: seekerId,
                type: NotificationType.SERVICE_REQUEST_ACCEPTED,
                title,
                body,
                targetType: NotificationTargetType.SERVICE_REQUEST,
                targetId: payload.requestId,
                metadata: {
                    providerId: payload.providerId,
                    providerName: payload.providerName,
                    orderId: payload.orderId,
                    totalAmount: payload.totalAmount,
                },
            });
        } catch (error) {
            this.logger.error(`Failed to save notification for seeker ${seekerId}:`, error);
        }

        // Then send FCM
        try {
            const tokens = await this.fcmTokenService.getTokens(seekerId);

            if (tokens.length === 0) {
                this.logger.warn(`No FCM tokens found for seeker ${seekerId}`);
                return;
            }

            const notification = { title, body };

            const data = {
                type: 'service-request-accepted',
                requestId: payload.requestId,
                providerId: payload.providerId,
                providerName: payload.providerName || '',
            };

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(tokens, notification, data);

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }

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

        const reasonMessages = {
            expired: 'The service request has expired',
            cancelled: 'The service request was cancelled',
            accepted_by_another: 'Another provider accepted this request',
        };

        const title = 'Request Closed';
        const body = reasonMessages[reason];

        // Save notification for each provider
        for (const providerId of providerIds) {
            try {
                await this.saveNotification({
                    userId: providerId,
                    type: NotificationType.SERVICE_REQUEST_CLOSED,
                    title,
                    body,
                    targetType: NotificationTargetType.SERVICE_REQUEST,
                    targetId: requestId,
                    metadata: { reason },
                });
            } catch (error) {
                this.logger.error(`Failed to save closed notification for provider ${providerId}:`, error);
            }
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

            const notification = { title, body };

            const data = {
                type: 'service-request-closed',
                requestId: requestId,
                reason: reason,
            };

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(allTokens, notification, data);

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }

            this.logger.log(`Notified ${allTokens.length} devices for ${providerIds.length} providers that request ${requestId} was closed (${reason})`);
        } catch (error) {
            this.logger.error(`Failed to notify providers about closure of request ${requestId}:`, error);
        }
    }

    /**
     * Notify seeker that no providers are available using FCM
     */
    async notifySeekerNoProviders(seekerId: string, requestId: string): Promise<void> {
        const title = 'No Providers Available';
        const body = 'Unfortunately, no service providers are available in your area for this request';

        // Save to database
        try {
            await this.saveNotification({
                userId: seekerId,
                type: NotificationType.SERVICE_REQUEST_NO_PROVIDERS,
                title,
                body,
                targetType: NotificationTargetType.SERVICE_REQUEST,
                targetId: requestId,
            });
        } catch (error) {
            this.logger.error(`Failed to save no-providers notification for seeker ${seekerId}:`, error);
        }

        try {
            const tokens = await this.fcmTokenService.getTokens(seekerId);

            if (tokens.length === 0) {
                this.logger.warn(`No FCM tokens found for seeker ${seekerId}`);
                return;
            }

            const notification = { title, body };

            const data = {
                type: 'service-request-no-providers',
                requestId: requestId,
            };

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(tokens, notification, data);

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }

            this.logger.log(`Notified seeker ${seekerId} that no providers available for request ${requestId}`);
        } catch (error) {
            this.logger.error(`Failed to notify seeker ${seekerId} about no providers:`, error);
        }
    }

    /**
     * Notify seeker that their request has expired using FCM
     */
    async notifySeekerExpired(seekerId: string, requestId: string): Promise<void> {
        const title = 'Request Expired';
        const body = 'Your service request has expired without being fulfilled';

        // Save to database
        try {
            await this.saveNotification({
                userId: seekerId,
                type: NotificationType.SERVICE_REQUEST_EXPIRED,
                title,
                body,
                targetType: NotificationTargetType.SERVICE_REQUEST,
                targetId: requestId,
            });
        } catch (error) {
            this.logger.error(`Failed to save expired notification for seeker ${seekerId}:`, error);
        }

        try {
            const tokens = await this.fcmTokenService.getTokens(seekerId);

            if (tokens.length === 0) {
                this.logger.warn(`No FCM tokens found for seeker ${seekerId}`);
                return;
            }

            const notification = { title, body };

            const data = {
                type: 'service-request-expired',
                requestId: requestId,
            };

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(tokens, notification, data);

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }

            this.logger.log(`Notified seeker ${seekerId} that request ${requestId} expired`);
        } catch (error) {
            this.logger.error(`Failed to notify seeker ${seekerId} about expiration:`, error);
        }
    }

    // ==================== Provider Payment & Review Notifications ====================

    /**
     * Notify provider about payment received
     */
    async notifyProviderPaymentReceived(
        providerId: string,
        payload: { orderId: string; amount: number; seekerName: string },
    ): Promise<void> {
        const title = 'Payment Received';
        const body = `You received ₹${payload.amount} from ${payload.seekerName}`;

        try {
            await this.saveNotification({
                userId: providerId,
                type: NotificationType.PAYMENT_RECEIVED,
                title,
                body,
                targetType: NotificationTargetType.ORDER,
                targetId: payload.orderId,
                metadata: payload,
            });
        } catch (error) {
            this.logger.error(`Failed to save payment notification for provider ${providerId}:`, error);
        }

        try {
            const tokens = await this.fcmTokenService.getTokens(providerId);
            if (tokens.length === 0) return;

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(
                tokens,
                { title, body },
                {
                    type: 'payment-received',
                    orderId: payload.orderId,
                    amount: payload.amount.toString(),
                },
            );

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }
        } catch (error) {
            this.logger.error(`Failed to send payment FCM to provider ${providerId}:`, error);
        }
    }

    /**
     * Notify provider about new review
     */
    async notifyProviderNewReview(
        providerId: string,
        payload: { orderId: string; rating: number; reviewerName: string; comment?: string },
    ): Promise<void> {
        const title = 'New Review Received';
        const body = `${payload.reviewerName} gave you ${payload.rating} stars`;

        try {
            await this.saveNotification({
                userId: providerId,
                type: NotificationType.NEW_REVIEW,
                title,
                body,
                targetType: NotificationTargetType.ORDER,
                targetId: payload.orderId,
                metadata: payload,
            });
        } catch (error) {
            this.logger.error(`Failed to save review notification for provider ${providerId}:`, error);
        }

        try {
            const tokens = await this.fcmTokenService.getTokens(providerId);
            if (tokens.length === 0) return;

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(
                tokens,
                { title, body },
                {
                    type: 'new-review',
                    orderId: payload.orderId,
                    rating: payload.rating.toString(),
                },
            );

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }
        } catch (error) {
            this.logger.error(`Failed to send review FCM to provider ${providerId}:`, error);
        }
    }

    // ==================== Order Status Change Notifications ====================

    /**
     * Notify seeker when order is in progress
     */
    async notifySeekerOrderInProgress(
        seekerId: string,
        payload: { orderId: string; requestId?: string; providerName: string; serviceName: string },
    ): Promise<void> {
        const title = 'Service Started';
        const body = `${payload.providerName} has started working on your ${payload.serviceName} request`;

        try {
            await this.saveNotification({
                userId: seekerId,
                type: NotificationType.ORDER_IN_PROGRESS,
                title,
                body,
                targetType: NotificationTargetType.SERVICE_REQUEST,
                targetId: payload.requestId || payload.orderId,
                metadata: payload,
            });
        } catch (error) {
            this.logger.error(`Failed to save in-progress notification for seeker ${seekerId}:`, error);
        }

        try {
            const tokens = await this.fcmTokenService.getTokens(seekerId);
            if (tokens.length === 0) return;

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(
                tokens,
                { title, body },
                {
                    type: 'order-in-progress',
                    orderId: payload.orderId,
                    requestId: payload.requestId,
                },
            );

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }
        } catch (error) {
            this.logger.error(`Failed to send in-progress FCM to seeker ${seekerId}:`, error);
        }
    }

    /**
     * Notify seeker when order is completed
     */
    async notifySeekerOrderCompleted(
        seekerId: string,
        payload: { orderId: string; providerName: string; serviceName: string },
    ): Promise<void> {
        const title = 'Service Completed';
        const body = `${payload.providerName} has completed your ${payload.serviceName} request`;

        try {
            await this.saveNotification({
                userId: seekerId,
                type: NotificationType.ORDER_COMPLETED,
                title,
                body,
                targetType: NotificationTargetType.ORDER,
                targetId: payload.orderId,
                metadata: payload,
            });
        } catch (error) {
            this.logger.error(`Failed to save completed notification for seeker ${seekerId}:`, error);
        }

        try {
            const tokens = await this.fcmTokenService.getTokens(seekerId);
            if (tokens.length === 0) return;

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(
                tokens,
                { title, body },
                {
                    type: 'order-completed',
                    orderId: payload.orderId,
                },
            );

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }
        } catch (error) {
            this.logger.error(`Failed to send completed FCM to seeker ${seekerId}:`, error);
        }
    }

    /**
     * Notify provider when order is marked completed (by seeker confirmation)
     */
    async notifyProviderOrderCompleted(
        providerId: string,
        payload: { orderId: string; seekerName: string; serviceName: string },
    ): Promise<void> {
        const title = 'Order Completed';
        const body = `Your ${payload.serviceName} service for ${payload.seekerName} has been marked complete`;

        try {
            await this.saveNotification({
                userId: providerId,
                type: NotificationType.ORDER_COMPLETED,
                title,
                body,
                targetType: NotificationTargetType.ORDER,
                targetId: payload.orderId,
                metadata: payload,
            });
        } catch (error) {
            this.logger.error(`Failed to save completed notification for provider ${providerId}:`, error);
        }

        try {
            const tokens = await this.fcmTokenService.getTokens(providerId);
            if (tokens.length === 0) return;

            const { invalidTokens } = await this.firebaseAdmin.sendMulticastNotification(
                tokens,
                { title, body },
                {
                    type: 'order-completed',
                    orderId: payload.orderId,
                },
            );

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                await this.fcmTokenService.removeInvalidTokens(invalidTokens);
            }
        } catch (error) {
            this.logger.error(`Failed to send completed FCM to provider ${providerId}:`, error);
        }
    }
}
