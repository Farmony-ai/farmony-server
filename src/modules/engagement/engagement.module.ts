import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications/notifications.module';

/**
 * Engagement Module - User Interactions Domain
 *
 * Aggregates all user engagement functionality:
 * - Notifications: Push, SMS, email notifications
 * - Ratings: Future - Extract from service-requests
 * - Messaging: Future - Chat between users
 */
@Module({
    imports: [
        NotificationsModule,
    ],
    exports: [
        NotificationsModule,
    ],
})
export class EngagementModule {}
