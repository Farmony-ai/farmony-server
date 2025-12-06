import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { pointDefinition } from '../../common/geo/geo.types';
import { GeoPointDto } from '../../common/geo/geo.dto';

export type UserDocument = User & Document & { _id: Types.ObjectId };

@Schema({ _id: false })
export class NotificationPreferences {
    @Prop({ type: Boolean, default: true })
    serviceRequestUpdates: boolean; // Accepted, expired, no providers

    @Prop({ type: Boolean, default: true })
    newOpportunities: boolean; // New service requests for providers

    @Prop({ type: Boolean, default: true })
    orderStatusUpdates: boolean; // In progress, completed

    @Prop({ type: Boolean, default: true })
    paymentUpdates: boolean; // Payment received

    @Prop({ type: Boolean, default: true })
    reviewUpdates: boolean; // New reviews
}

const NotificationPreferencesSchema = SchemaFactory.createForClass(NotificationPreferences);

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

    @Prop({ type: NotificationPreferencesSchema, default: () => ({}) })
    notificationPreferences: NotificationPreferences;
}

const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);

/**
 * Address type enum for categorizing addresses
 * Used across the platform for user addresses, listing locations, etc.
 */
export enum AddressType {
    HOME = 'home',
    WORK = 'work',
    PERSONAL = 'personal',
    OTHER = 'other',
    FARM = 'farm',
    WAREHOUSE = 'warehouse',
    SERVICE_AREA = 'service_area',
    DELIVERY_POINT = 'delivery_point',
    MEETING_SPOT = 'meeting_spot',
}

@Schema({ _id: true, timestamps: true })
export class Address {
    _id?: Types.ObjectId;

    @Prop({
        type: String,
        enum: Object.values(AddressType),
        required: true,
    })
    addressType: AddressType;

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

    @Prop({ type: MongooseSchema.Types.Mixed })
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };

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
// Add geospatial index for location field
AddressSchema.index({ location: '2dsphere' });

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

    @Prop({ type: String, index: true })
    phone?: string;

    @Prop({ type: String, required: true, unique: true, index: true })
    firebaseUserId: string;

    @Prop({ type: String })
    profilePictureKey?: string;

    @Prop({ type: String, enum: ['male', 'female', 'other'] })
    gender?: string;

    @Prop({ type: Date })
    dateOfBirth?: Date;

    @Prop({ type: String })
    bio?: string;

    @Prop({ type: String })
    occupation?: string;

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

    // Docs-aligned optional fields
    @Prop({ type: Number })
    serviceRadius?: number;

    @Prop({ type: Number, default: 0 })
    qualityScore?: number;

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

    @Prop({ type: [String], default: [] })
    fcmTokens: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
// Ensure geospatial index for nested addresses
UserSchema.index({ 'addresses.location': '2dsphere' });
