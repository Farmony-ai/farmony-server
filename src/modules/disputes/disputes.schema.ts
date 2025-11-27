import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DisputeDocument = Dispute & Document;

export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum DisputeResolution {
  PENDING = 'pending',
  REFUND_TO_SEEKER = 'refund_to_seeker',
  RELEASE_TO_PROVIDER = 'release_to_provider',
  PARTIAL_REFUND = 'partial_refund'
}

@Schema({ timestamps: true })
export class Dispute {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, unique: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  raisedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  againstUser: Types.ObjectId;

  @Prop({ type: String, required: true })
  reason: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: [String], default: [] })
  evidenceUrls: string[]; // Screenshots, photos

  @Prop({ type: String, enum: Object.values(DisputeStatus), default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Prop({ type: String, enum: Object.values(DisputeResolution), default: DisputeResolution.PENDING })
  resolution: DisputeResolution;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId; // Admin who resolved

  @Prop({ type: Date })
  resolvedAt?: Date;

  @Prop({ type: String })
  adminNotes?: string;

  @Prop({ type: Number })
  refundAmount?: number; // For partial refunds

  @Prop({ type: Date })
  escalatedAt?: Date;

  @Prop({ type: [{ 
    userId: { type: Types.ObjectId, ref: 'User' },
    message: String,
    createdAt: Date
  }], default: [] })
  messages: Array<{
    userId: Types.ObjectId;
    message: string;
    createdAt: Date;
  }>;
}

export const DisputeSchema = SchemaFactory.createForClass(Dispute);
// orderId index is already created by unique: true in @Prop decorator
DisputeSchema.index({ raisedBy: 1, status: 1 });
DisputeSchema.index({ status: 1, createdAt: -1 });
