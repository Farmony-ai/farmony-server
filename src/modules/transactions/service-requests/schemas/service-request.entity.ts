// src/modules/service-requests/entities/service-request.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { GeoPointDto } from '../../../common/geo/geo.dto';
import { v4 as uuidv4 } from 'uuid';

export type ServiceRequestDocument = ServiceRequest & Document;

export enum ServiceRequestStatus {
  OPEN = 'open',
  MATCHED = 'matched', 
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
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

// Docs-aligned lifecycle subdocuments
@Schema({ _id: false })
export class MatchingLifecycle {
  @Prop({ type: [NotificationWaveSchema], default: [] })
  notificationWaves: NotificationWave[];

  @Prop({ type: Number, default: 0 })
  currentWave: number;

  @Prop({ type: Date })
  nextWaveAt?: Date;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  allNotifiedProviders: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  declinedProviders: Types.ObjectId[];
}

const MatchingLifecycleSchema = SchemaFactory.createForClass(MatchingLifecycle);

@Schema({ _id: false })
export class PaymentEscrowAuditLogItem {
  @Prop({ type: String }) action?: string;
  @Prop({ type: Object }) by?: any;
  @Prop({ type: Date }) at?: Date;
  @Prop({ type: Object }) meta?: any;
}

const PaymentEscrowAuditLogItemSchema = SchemaFactory.createForClass(PaymentEscrowAuditLogItem);

@Schema({ _id: false })
export class PaymentEscrow {
  @Prop({ type: String, enum: ['held', 'released', 'refunded', 'disputed', 'partial_refund'] })
  status?: string;
  @Prop({ type: Number }) amount?: number;
  @Prop({ type: Date }) heldAt?: Date;
  @Prop({ type: Date }) releasedAt?: Date;
  @Prop({ type: Date }) refundedAt?: Date;
  @Prop({ type: String }) transactionId?: string;
  @Prop({ type: [PaymentEscrowAuditLogItemSchema], default: [] }) auditLog?: PaymentEscrowAuditLogItem[];
}

const PaymentEscrowSchema = SchemaFactory.createForClass(PaymentEscrow);

@Schema({ _id: false })
export class PaymentCommission {
  @Prop({ type: Number }) amount?: number;
  @Prop({ type: Number }) percentage?: number;
  @Prop({ type: Date }) paidAt?: Date;
}

const PaymentCommissionSchema = SchemaFactory.createForClass(PaymentCommission);

@Schema({ _id: false })
export class PaymentInfo {
  @Prop({ type: Number }) totalAmount?: number;
  @Prop({ type: Date }) paidAt?: Date;
  @Prop({ type: Boolean, default: false }) isAutoRejected?: boolean;
  @Prop({ type: PaymentEscrowSchema }) escrow?: PaymentEscrow;
  @Prop({ type: PaymentCommissionSchema }) commission?: PaymentCommission;
}

const PaymentInfoSchema = SchemaFactory.createForClass(PaymentInfo);

@Schema({ _id: false })
export class RatingInfo {
  @Prop({ type: Number }) score?: number;
  @Prop({ type: String }) review?: string;
  @Prop({ type: Date }) createdAt?: Date;
}

const RatingInfoSchema = SchemaFactory.createForClass(RatingInfo);

@Schema({ _id: false })
export class RatingsBlock {
  @Prop({ type: RatingInfoSchema }) seekerToProvider?: RatingInfo;
  @Prop({ type: RatingInfoSchema }) providerToSeeker?: RatingInfo;
}

const RatingsBlockSchema = SchemaFactory.createForClass(RatingsBlock);

@Schema({ _id: false })
export class DisputeMessage {
  @Prop({ type: Types.ObjectId, ref: 'User' }) userId?: Types.ObjectId;
  @Prop({ type: String }) message?: string;
  @Prop({ type: Date }) createdAt?: Date;
}

const DisputeMessageSchema = SchemaFactory.createForClass(DisputeMessage);

@Schema({ _id: false })
export class DisputeInfo {
  @Prop({ type: Types.ObjectId, ref: 'User' }) raisedBy?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) againstUser?: Types.ObjectId;
  @Prop({ type: String }) reason?: string;
  @Prop({ type: String }) description?: string;
  @Prop({ type: [String] }) evidenceUrls?: string[];
  @Prop({ type: String, enum: ['open', 'under_review', 'resolved', 'closed'] }) status?: string;
  @Prop({ type: String, enum: ['pending', 'refund_to_seeker', 'release_to_provider', 'partial_refund'] }) resolution?: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) resolvedBy?: Types.ObjectId;
  @Prop({ type: Date }) resolvedAt?: Date;
  @Prop({ type: String }) adminNotes?: string;
  @Prop({ type: Number }) refundAmount?: number;
  @Prop({ type: Date }) escalatedAt?: Date;
  @Prop({ type: [DisputeMessageSchema], default: [] }) messages?: DisputeMessage[];
}

const DisputeInfoSchema = SchemaFactory.createForClass(DisputeInfo);

@Schema({ _id: false })
export class OrderLifecycle {
  @Prop({ type: Date }) acceptedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) providerId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Listing' }) listingId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Order' }) orderRef?: Types.ObjectId;
  @Prop({ type: Number }) agreedPrice?: number;
  @Prop({ type: PaymentInfoSchema }) payment?: PaymentInfo;
  @Prop({ type: RatingsBlockSchema }) ratings?: RatingsBlock;
  @Prop({ type: DisputeInfoSchema }) dispute?: DisputeInfo;
}

const OrderLifecycleSchema = SchemaFactory.createForClass(OrderLifecycle);

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
  location: GeoPointDto;

  // Docs: address string
  
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

  // (removed placeholder; real lifecycle defined below)

  // Docs-aligned lifecycle
  @Prop({
    type: {
      matching: MatchingLifecycleSchema,
      order: OrderLifecycleSchema,
    },
    default: {},
  })
  lifecycle?: {
    matching?: MatchingLifecycle;
    order?: OrderLifecycle;
  };

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

  @Prop({ type: Types.ObjectId, ref: 'Address' })
  serviceAddressId?: Types.ObjectId;
}

const ServiceRequestSchema = SchemaFactory.createForClass(ServiceRequest);

// Indexes for efficient queries
ServiceRequestSchema.index({ location: '2dsphere' });
ServiceRequestSchema.index({ seekerId: 1, status: 1 });
ServiceRequestSchema.index({ categoryId: 1, status: 1 });
ServiceRequestSchema.index({ status: 1, expiresAt: 1 });
ServiceRequestSchema.index({ 'lifecycle.matching.nextWaveAt': 1 }); // For wave processing
ServiceRequestSchema.index({ 'lifecycle.order.providerId': 1, status: 1 });
ServiceRequestSchema.index({ createdAt: -1 });




export { ServiceRequestSchema };
