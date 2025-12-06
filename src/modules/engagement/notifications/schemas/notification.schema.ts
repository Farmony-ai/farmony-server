import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document & { _id: Types.ObjectId };

export enum NotificationType {
    // Seeker notifications
    SERVICE_REQUEST_ACCEPTED = 'service-request-accepted',
    SERVICE_REQUEST_EXPIRED = 'service-request-expired',
    SERVICE_REQUEST_NO_PROVIDERS = 'service-request-no-providers',
    // Provider notifications
    SERVICE_REQUEST_NEW_OPPORTUNITY = 'service-request-new-opportunity',
    SERVICE_REQUEST_CLOSED = 'service-request-closed',
    PAYMENT_RECEIVED = 'payment-received',
    NEW_REVIEW = 'new-review',
    // Order status notifications (both seeker and provider)
    ORDER_IN_PROGRESS = 'order-in-progress',
    ORDER_COMPLETED = 'order-completed',
}

export enum NotificationTargetType {
    SERVICE_REQUEST = 'service_request',
    ORDER = 'order',
    REVIEW = 'review',
    PROVIDER_DASHBOARD = 'provider_dashboard',
}

@Schema({ timestamps: true })
export class Notification {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: String, enum: Object.values(NotificationType), required: true })
    type: NotificationType;

    @Prop({ type: String, required: true })
    title: string;

    @Prop({ type: String, required: true })
    body: string;

    @Prop({ type: String })
    imageUrl?: string;

    @Prop({ type: String, enum: Object.values(NotificationTargetType) })
    targetType?: NotificationTargetType;

    @Prop({ type: String })
    targetId?: string;

    @Prop({ type: Object })
    metadata?: Record<string, any>;

    @Prop({ type: Boolean, default: false, index: true })
    isRead: boolean;

    @Prop({ type: Date })
    readAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
