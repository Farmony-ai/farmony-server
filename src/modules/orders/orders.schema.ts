import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderType {
  RENTAL = 'rental',
  HIRING = 'hiring',
  PURCHASE = 'purchase',
  SERVICE = 'service'
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'Listing' })
  listingId?: Types.ObjectId;

  @Prop({ type: String, ref: 'ServiceRequest' })
  serviceRequestId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  seekerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  providerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubCategory' })
  subCategoryId?: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['pending','accepted','paid','completed','canceled'] })
  status: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ type: String, enum: Object.values(OrderType), required: true })
  orderType: OrderType;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date })
  requestExpiresAt: Date; // Auto-reject after this time (2 hours from creation)

  @Prop({ type: Date })
  serviceStartDate?: Date;

  @Prop({ type: Date })
  serviceEndDate?: Date;

  @Prop({ type: Number })
  quantity?: number;

  @Prop({ type: String })
  unitOfMeasure?: string;

  @Prop({ type: Number, required: true })
  totalAmount: number;

  @Prop({ type: [Number] })
  coordinates?: number[];

  @Prop({ type: Boolean, default: false })
  isAutoRejected: boolean;

  @Prop({ type: Date })
  acceptedAt?: Date;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  canceledAt?: Date;

  @Prop({ type: String })
  cancellationReason?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ providerId: 1, status: 1 });
OrderSchema.index({ seekerId: 1, status: 1 });
OrderSchema.index({ requestExpiresAt: 1, status: 1 });
