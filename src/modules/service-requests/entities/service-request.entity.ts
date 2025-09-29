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
}

export enum ServiceRequestUrgency {
  IMMEDIATE = 'immediate',
  SCHEDULED = 'scheduled',
  FLEXIBLE = 'flexible',
}

@Schema({ timestamps: true, _id: false })
export class ServiceRequest {
  @Prop({ type: String, default: uuidv4, unique: true })
  _id: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  seekerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubCategory' })
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
    coordinates: [number, number];
  };

  @Prop({ type: String })
  address?: string;

  @Prop({ type: Date, required: true })
  serviceStartDate: Date;

  @Prop({ type: Date, required: true })
  serviceEndDate: Date;

  @Prop({
    type: {
      min: { type: Number },
      max: { type: Number },
    },
  })
  budget?: {
    min: number;
    max: number;
  };

  @Prop({
    type: String,
    enum: Object.values(ServiceRequestUrgency),
    default: ServiceRequestUrgency.FLEXIBLE,
  })
  urgency: ServiceRequestUrgency;

  @Prop({
    type: String,
    enum: Object.values(ServiceRequestStatus),
    default: ServiceRequestStatus.OPEN,
  })
  status: ServiceRequestStatus;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: String, ref: 'MatchRequest' })
  matchRequestId?: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  matchedProviderIds: Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  viewedBy: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  acceptedProviderId?: Types.ObjectId;

  @Prop({ type: Date })
  acceptedAt?: Date;

  @Prop({ type: String, ref: 'Order' })
  orderId?: string;

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
    duration?: number;
    specialRequirements?: string[];
  };

  @Prop({ type: [String], default: [] })
  attachments?: string[];

  @Prop({ type: Boolean, default: false })
  isAutoExpired: boolean;

  @Prop({ type: String })
  cancellationReason?: string;

  @Prop({ type: Date })
  completedAt?: Date;
}

const ServiceRequestSchema = SchemaFactory.createForClass(ServiceRequest);

ServiceRequestSchema.index({ location: '2dsphere' });
ServiceRequestSchema.index({ seekerId: 1, status: 1 });
ServiceRequestSchema.index({ categoryId: 1, status: 1 });
ServiceRequestSchema.index({ matchRequestId: 1 });
ServiceRequestSchema.index({ status: 1, expiresAt: 1 });
ServiceRequestSchema.index({ acceptedProviderId: 1, status: 1 });
ServiceRequestSchema.index({ matchedProviderIds: 1 });
ServiceRequestSchema.index({ createdAt: -1 });

export { ServiceRequestSchema };