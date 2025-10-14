import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AddressDocument = Address & Document;

@Schema({ timestamps: true })
export class Address {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // Enhanced address classification
  @Prop({
    type: String,
    required: true,
    enum: ['home', 'work', 'personal', 'other', 'farm', 'warehouse', 'service_area', 'delivery_point', 'meeting_spot']
  })
  addressType: string; // Renamed from 'tag' for clarity

  @Prop({ type: String })
  customLabel?: string; // "North Field", "Main Warehouse", etc.

  // Structured Address (Indian Rural Context)
  @Prop({ type: String, required: true })
  addressLine1: string;

  @Prop({ type: String })
  addressLine2?: string;

  @Prop({ type: String, required: true })
  village: string;

  @Prop({ type: String })
  tehsil?: string;

  @Prop({ type: String, required: true })
  district: string;

  @Prop({ type: String, required: true })
  state: string;

  @Prop({ type: String, required: true, match: /^\d{6}$/ })
  pincode: string;

  // Enhanced Geolocation
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
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({ type: Number, min: 1, max: 100 })
  accuracy?: number; // GPS accuracy in meters

  // Address Metadata
  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean; // Admin or GPS verified

  // Service Context
  @Prop({ type: [String] })
  serviceCategories?: string[]; // Categories this address supports

  @Prop({ type: String })
  accessInstructions?: string; // "Behind temple", "Next to water tank"

  // Usage Tracking
  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: Number, default: 0 })
  usageCount: number;

  // Backward compatibility - keep old 'coordinates' field for existing data
  @Prop({ type: [Number] })
  coordinates?: number[]; // Deprecated: use location.coordinates instead
  private _id: any;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

// Enhanced indexes for performance
AddressSchema.index({ userId: 1 });
AddressSchema.index({ location: '2dsphere' }); // New geospatial index
AddressSchema.index({ coordinates: '2dsphere' }); // Keep for backward compatibility
AddressSchema.index({ userId: 1, addressType: 1 });
AddressSchema.index({ userId: 1, isDefault: 1 });
AddressSchema.index({ userId: 1, usageCount: -1 }); // For frequently used addresses
AddressSchema.index({ district: 1, state: 1 }); // For regional queries