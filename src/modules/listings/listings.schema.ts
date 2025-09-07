import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ListingDocument = Listing & Document;

@Schema({ timestamps: true })
export class Listing {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  providerId: Types.ObjectId;

  @Prop({ type: String, required: false })
  title: string;

  @Prop({ type: String, required: false })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Catalogue', required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Catalogue', required: true })
  subCategoryId: Types.ObjectId;
  
  @Prop({ type: String })
  category: string;
  
  @Prop({ type: String })
  subcategory: string;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ type: String })
  videoUrl?: string; // For video demonstrations

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number],
      required: false
    }
  })
  location: {
    type: string;
    coordinates: number[];
  };

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: String, required: true, enum: ['per_hour', 'per_day', 'per_piece', 'per_kg', 'per_unit'] })
  unitOfMeasure: string;

  @Prop({ type: Number })
  minimumOrder?: number; // Minimum quantity/duration

  @Prop({ type: Date })
  availableFrom: Date;

  @Prop({ type: Date })
  availableTo: Date;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop({ type: Number, default: 0 })
  bookingCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[]; // For better search

  @Prop({ type: String })
  termsAndConditions?: string;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean; // Admin verified listing
}

export const ListingSchema = SchemaFactory.createForClass(Listing);
ListingSchema.index({ location: '2dsphere' });
ListingSchema.index({ providerId: 1, isActive: 1 });
ListingSchema.index({ categoryId: 1, subCategoryId: 1, isActive: 1 });
ListingSchema.index({ tags: 1 });
ListingSchema.index({ title: 'text', description: 'text' });