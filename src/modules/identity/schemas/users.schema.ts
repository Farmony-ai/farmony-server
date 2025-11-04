import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { pointDefinition } from '../../common/geo/geo.types';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class UserPreferences {
    @Prop({ type: String, default: 'seeker', enum: ['provider', 'seeker'] })
    defaultLandingPage: string;

    @Prop({ type: String, default: 'listings' })
    defaultProviderTab: string;

    @Prop({ type: String })
    preferredLanguage?: string;

    @Prop({ type: Boolean, default: true })
    notificationsEnabled: boolean;
}

const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);

@Schema({ _id: true, timestamps: true })
export class Address {
    @Prop({
        type: String,
        enum: ['home', 'work', 'personal', 'other', 'farm', 'warehouse', 'service_area', 'delivery_point', 'meeting_spot'],
        required: true,
    })
    addressType: string;

    @Prop({ type: String })
    customLabel?: string;

    @Prop({ type: String, required: true })
    addressLine1: string;

    @Prop({ type: String })
    addressLine2?: string;

    @Prop({ type: String })
    village?: string;

    @Prop({ type: String })
    tehsil?: string;

    @Prop({ type: String })
    district?: string;

    @Prop({ type: String })
    state?: string;

    @Prop({ type: String })
    pincode?: string;

    @Prop({ type: pointDefinition, index: '2dsphere' })
    location?: { type: 'Point'; coordinates: [number, number] };

    @Prop({ type: Number })
    accuracy?: number;

    @Prop({ type: Boolean, default: false })
    isDefault: boolean;

    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    @Prop({ type: Boolean, default: false })
    isVerified: boolean;

    @Prop({ type: String })
    accessInstructions?: string;

    @Prop({ type: [Types.ObjectId], ref: 'Catalogue' })
    serviceCategories?: Types.ObjectId[];

    @Prop({ type: Date })
    lastUsedAt?: Date;

    @Prop({ type: Number, default: 0 })
    usageCount: number;
}

const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ _id: false })
export class RatingSummary {
    @Prop({ type: Number })
    averageScore?: number;

    @Prop({ type: Number })
    totalReviews?: number;

    @Prop({ type: Map, of: Number })
    distribution?: Map<string, number>;
}

const RatingSummarySchema = SchemaFactory.createForClass(RatingSummary);

@Schema({ _id: false })
export class RecentRating {
    @Prop({ type: Types.ObjectId })
    orderId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    from: Types.ObjectId;

    @Prop({ type: Number })
    score: number;

    @Prop({ type: String })
    review?: string;

    @Prop({ type: Date })
    createdAt: Date;
}

const RecentRatingSchema = SchemaFactory.createForClass(RecentRating);

@Schema({ timestamps: true })
export class User {
    @Prop({ type: String, required: true })
    name: string;

    @Prop({ type: String })
    email?: string;

    @Prop({ type: String, required: true, index: true })
    phone: string;

    @Prop({ type: String })
    profilePicture?: string;

    @Prop({ type: String, required: true, enum: ['individual', 'SHG', 'FPO', 'admin'], default: 'individual' })
    role: string;

    @Prop({ type: Boolean, default: false })
    isVerified: boolean;

    @Prop({ type: String, default: 'none', enum: ['none', 'pending', 'approved', 'rejected'] })
    kycStatus: string;

    @Prop({ type: UserPreferencesSchema, default: () => ({}) })
    preferences: UserPreferences;

    @Prop({ type: [AddressSchema], default: [] })
    addresses: Address[];

    @Prop({ type: Types.ObjectId })
    defaultAddressId?: Types.ObjectId;

    @Prop({ type: [Types.ObjectId], ref: 'Catalogue' })
    serviceCategories?: Types.ObjectId[];

    @Prop({
        type: {
            asProvider: RatingSummarySchema,
            asSeeker: RatingSummarySchema,
        },
    })
    ratingSummary?: {
        asProvider?: RatingSummary;
        asSeeker?: RatingSummary;
    };

    @Prop({ type: [RecentRatingSchema], default: [] })
    recentRatings: RecentRating[];
}

export const UserSchema = SchemaFactory.createForClass(User);
