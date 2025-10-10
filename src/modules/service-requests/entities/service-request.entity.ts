// src/modules/service-requests/entities/service-request.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type ServiceRequestDocument = ServiceRequest & Document;

export enum ServiceRequestStatus {
  OPEN = 'open',
  MATCHED = 'matched', 
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_PROVIDERS_AVAILABLE = 'no_providers_available'
}

// Wave notification tracking
@Schema({ _id: false })
export class NotificationWave {
  @Prop({ type: Number, required: true })
  waveNumber: number;

  @Prop({ type: Number, required: true })
  radius: number; // in meters

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  notifiedProviders: Types.ObjectId[];

  @Prop({ type: Date, required: true })
  notifiedAt: Date;

  @Prop({ type: Number, default: 0 })
  providersCount: number;
}

const NotificationWaveSchema = SchemaFactory.createForClass(NotificationWave);

@Schema({ timestamps: true, _id: false })
export class ServiceRequest {
  @Prop({ type: String, default: uuidv4, unique: true })
  _id: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  seekerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Catalogue', required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Catalogue' })
  subCategoryId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({ type: String })
  address?: string;

  @Prop({ type: Date, required: true })
  serviceStartDate: Date;

  @Prop({ type: Date, required: true })
  serviceEndDate: Date;

  @Prop({
    type: String,
    enum: Object.values(ServiceRequestStatus),
    default: ServiceRequestStatus.OPEN,
  })
  status: ServiceRequestStatus;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  // Wave-based notification tracking
  @Prop({ type: [NotificationWaveSchema], default: [] })
  notificationWaves: NotificationWave[];

  @Prop({ type: Number, default: 0 })
  currentWave: number;

  @Prop({ type: Date })
  nextWaveAt?: Date; // When to trigger next wave

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  allNotifiedProviders: Types.ObjectId[]; // All providers ever notified

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  declinedProviders: Types.ObjectId[]; // Providers who explicitly declined

  // Acceptance tracking
  @Prop({ type: Types.ObjectId, ref: 'User' })
  acceptedProviderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Listing' })
  acceptedListingId?: Types.ObjectId; // Link to provider's listing for pricing

  @Prop({ type: Date })
  acceptedAt?: Date;

  @Prop({ type: Number })
  acceptedPrice?: number; // Price from the listing

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  // Request metadata
  @Prop({
    type: {
      quantity: { type: Number },
      unitOfMeasure: { type: String },
      duration: { type: Number },
      specialRequirements: { type: [String] },
    },
  })
  metadata?: {
    quantity?: number;
    unitOfMeasure?: string;
    duration?: number; // in hours
    specialRequirements?: string[];
  };

  @Prop({ type: [String], default: [] })
  attachments?: string[]; // S3 keys for any attached files

  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop({ type: Boolean, default: false })
  isAutoExpired: boolean;

  @Prop({ type: String })
  cancellationReason?: string;

  @Prop({ type: Date })
  completedAt?: Date;
}

const ServiceRequestSchema = SchemaFactory.createForClass(ServiceRequest);

// Indexes for efficient queries
ServiceRequestSchema.index({ location: '2dsphere' });
ServiceRequestSchema.index({ seekerId: 1, status: 1 });
ServiceRequestSchema.index({ categoryId: 1, status: 1 });
ServiceRequestSchema.index({ status: 1, expiresAt: 1 });
ServiceRequestSchema.index({ acceptedProviderId: 1, status: 1 });
ServiceRequestSchema.index({ status: 1, nextWaveAt: 1 }); // For wave processing
ServiceRequestSchema.index({ createdAt: -1 });

export { ServiceRequestSchema };