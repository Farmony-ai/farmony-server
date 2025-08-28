import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AddressDocument = Address & Document;

@Schema({ timestamps: true })
export class Address {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['home', 'work', 'personal', 'other'] })
  tag: string;

  @Prop({ type: String, required: true })
  addressLine1: string;

  @Prop({ type: String })
  addressLine2: string;

  @Prop({ type: String, required: true })
  village: string;

  @Prop({ type: String})
  tehsil: string;

  @Prop({ type: String, required: true })
  district: string;

  @Prop({ type: String, required: true })
  state: string;

  @Prop({ type: String, required: true })
  pincode: string;

  @Prop({ type: [Number], required: true })
  coordinates: number[]; // [longitude, latitude]

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
AddressSchema.index({ userId: 1 });
AddressSchema.index({ coordinates: '2dsphere' });