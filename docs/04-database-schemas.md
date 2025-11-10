# Mongoose Models

This file contains all the Mongoose schemas for the application.

---

## `catalogue.schema.ts`

```typescript
import { Schema, model } from 'mongoose';
import type { CatalogueDoc } from '../interfaces/catalogue.interface';

const CatalogueSchema = new Schema<CatalogueDoc>(
    {
        name: { type: String, required: true, unique: true },
        description: String,
        category: {
            type: String,
            enum: ['machines_equipment', 'manpower', 'materials_tools'],
            required: true,
        },
        transactionType: {
            type: String,
            enum: ['rental', 'hiring'],
            required: true,
        },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: 'Catalogue',
            default: null,
        },
        icon: String,
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
        categoryPath: [{ type: String }],
        fullPath: String,
        defaultUnitOfMeasure: {
            type: String,
            enum: ['per_hour', 'per_day', 'per_unit'],
        },
        suggestedMinPrice: Number,
        suggestedMaxPrice: Number,
    },
    { timestamps: true }
);

CatalogueSchema.index({ parentId: 1 });
CatalogueSchema.index({ category: 1, isActive: 1 });
CatalogueSchema.index({ categoryPath: 1 });

export const Catalogue = model('Catalogue', CatalogueSchema);
```

---

## `conversation.schema.ts`

```typescript
import { Schema, model } from 'mongoose';
import type { ConversationDoc } from '../interfaces/conversation.interface';

const ConversationSchema = new Schema<ConversationDoc>(
    {
        participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
        relatedOrderId: { type: Schema.Types.ObjectId },
        lastActivity: { type: Date, default: () => new Date(), index: true },
        lastReadBy: { type: Map, of: Date, default: {} },
        unreadCount: { type: Map, of: Number, default: {} },
    },
    { timestamps: true }
);

ConversationSchema.index({ participants: 1 });

export const Conversation = model('Conversation', ConversationSchema);
```

---

## `conversationBucket.schema.ts`

```typescript
import { Schema, model } from 'mongoose';
import type { ConversationBucketDoc } from '../interfaces/conversationBucket.interface';

const ConversationBucketSchema = new Schema<ConversationBucketDoc>(
    {
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
        },
        bucketNumber: { type: Number, required: true },
        messages: [
            {
                senderId: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
                recipientId: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
                type: {
                    type: String,
                    enum: ['text', 'image', 'location', 'order_reference'],
                    default: 'text',
                },
                content: String,
                status: {
                    type: String,
                    enum: ['sent', 'delivered', 'read'],
                    default: 'sent',
                },
                timestamp: { type: Date, default: () => new Date() },
                metadata: { type: Map, of: Schema.Types.Mixed },
            },
        ],
        messageCount: { type: Number, default: 0 },
        firstMessageAt: Date,
        lastMessageAt: Date,
    },
    { timestamps: true }
);

ConversationBucketSchema.index({ conversationId: 1, bucketNumber: -1 });

export const ConversationBucket = model('ConversationBucket', ConversationBucketSchema);
```

---

## `listing.schema.ts`

```typescript
import { Schema, model } from 'mongoose';
import { pointDefinition } from './common/geo';
import type { ListingDoc } from '../interfaces/listing.interface';

const ListingSchema = new Schema<ListingDoc>(
    {
        providerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        title: String,
        description: String,
        photos: { type: [String], default: [] },
        videoUrl: String,
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: 'Catalogue',
            required: true,
            index: true,
        },
        serviceAddress: {
            addressId: { type: Schema.Types.ObjectId },
            village: String,
            district: String,
            state: String,
            pincode: String,
            location: { type: pointDefinition },
        },
        price: { type: Number, required: true },
        unitOfMeasure: {
            type: String,
            enum: ['per_hour', 'per_day', 'per_piece', 'per_kg', 'per_unit'],
            required: true,
        },
        minimumOrder: Number,
        availability: {
            defaultSchedule: { type: Schema.Types.Mixed },
            blockedDates: [String],
            customDates: [{ date: String, slots: [{ start: String, end: String }] }],
        },
        availableFrom: Date,
        availableTo: Date,
        isActive: { type: Boolean, default: true, index: true },
        isVerified: { type: Boolean, default: false },
        tags: { type: [String], default: [] },
        termsAndConditions: String,
        viewCount: { type: Number, default: 0 },
        bookingCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

ListingSchema.index({ 'serviceAddress.location': '2dsphere' });
ListingSchema.index({ categoryId: 1, isActive: 1 });

export const Listing = model('Listing', ListingSchema);
```

---

## `matchRequest.schema.ts`

```typescript
import { Schema, model, Types } from 'mongoose';
import { pointDefinition } from './common/geo';
import type { MatchRequestDoc } from '../interfaces/matchRequest.interface';

const MatchRequestSchema = new Schema<MatchRequestDoc>(
    {
        _id: { type: String, required: true }, // UUID
        seekerId: { type: Schema.Types.ObjectId, ref: 'User' },
        userPoint: {
            type: pointDefinition,
        },
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: 'Catalogue',
            required: true,
        },
        limitN: { type: Number, default: 20 },
        status: {
            type: String,
            enum: ['CREATED', 'NO_COVERAGE', 'ERROR'],
            default: 'CREATED',
        },
        candidates: [
            {
                providerId: { type: Types.ObjectId, ref: 'User' },
                distanceMeters: Number,
                rankOrder: Number,
                providerName: String,
                providerRating: Number,
                providerPhone: String,
            },
        ],
        expiresAt: { type: Date, required: true, index: true }, // TTL below
        idempotencyKey: { type: String, unique: true, sparse: true },
    },
    { timestamps: true }
);

// Normalize: ensure 2dsphere index is on the GeoJSON object field
MatchRequestSchema.index({ userPoint: '2dsphere' });
// TTL index (ensure your MongoDB has TTL monitor enabled)
MatchRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MatchRequest = model('MatchRequest', MatchRequestSchema);
```

---

## `serviceRequest.schema.ts`

```typescript
import { Schema, model, Types } from 'mongoose';
import { pointDefinition } from './common/geo';
import type { ServiceRequestDoc } from '../interfaces/serviceRequest.interface';

const ServiceRequestSchema = new Schema<ServiceRequestDoc>(
    {
        _id: { type: String, required: true }, // UUID
        seekerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        title: { type: String, required: true },
        description: String,
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: 'Catalogue',
            required: true,
            index: true,
        },
        location: { type: pointDefinition },
        address: String,
        serviceStartDate: { type: Date, required: true },
        serviceEndDate: { type: Date, required: true },
        expiresAt: { type: Date, required: true, index: true },
        status: {
            type: String,
            enum: ['open', 'matched', 'accepted', 'in_progress', 'expired', 'cancelled', 'completed', 'no_providers_available', 'under_dispute'],
            default: 'open',
            index: true,
        },
        lifecycle: {
            matching: {
                notificationWaves: [
                    {
                        waveNumber: Number,
                        radius: Number,
                        notifiedProviders: [{ type: Types.ObjectId, ref: 'User' }],
                        notifiedAt: Date,
                        providersCount: Number,
                    },
                ],
                currentWave: Number,
                nextWaveAt: Date,
                allNotifiedProviders: [{ type: Types.ObjectId, ref: 'User' }],
                declinedProviders: [{ type: Types.ObjectId, ref: 'User' }],
            },
            order: {
                acceptedAt: Date,
                providerId: { type: Types.ObjectId, ref: 'User', index: true },
                listingId: { type: Types.ObjectId, ref: 'Listing' },
                agreedPrice: Number,
                payment: {
                    totalAmount: Number,
                    paidAt: Date,
                    isAutoRejected: Boolean,
                    escrow: {
                        status: {
                            type: String,
                            enum: ['held', 'released', 'refunded', 'disputed', 'partial_refund'],
                        },
                        amount: Number,
                        heldAt: Date,
                        releasedAt: Date,
                        refundedAt: Date,
                        transactionId: String,
                        auditLog: [
                            {
                                action: String,
                                by: Schema.Types.Mixed,
                                at: Date,
                                meta: Schema.Types.Mixed,
                            },
                        ],
                    },
                    commission: {
                        amount: Number,
                        percentage: Number,
                        paidAt: Date,
                    },
                },
                ratings: {
                    seekerToProvider: {
                        score: Number,
                        review: String,
                        createdAt: Date,
                    },
                    providerToSeeker: {
                        score: Number,
                        review: String,
                        createdAt: Date,
                    },
                },
                dispute: {
                    raisedBy: { type: Types.ObjectId, ref: 'User' },
                    againstUser: { type: Types.ObjectId, ref: 'User' },
                    reason: String,
                    description: String,
                    evidenceUrls: [String],
                    status: {
                        type: String,
                        enum: ['open', 'under_review', 'resolved', 'closed'],
                    },
                    resolution: {
                        type: String,
                        enum: ['pending', 'refund_to_seeker', 'release_to_provider', 'partial_refund'],
                    },
                    resolvedBy: { type: Types.ObjectId, ref: 'User' },
                    resolvedAt: Date,
                    adminNotes: String,
                    refundAmount: Number,
                    escalatedAt: Date,
                    messages: [
                        {
                            userId: { type: Types.ObjectId, ref: 'User' },
                            message: String,
                            createdAt: Date,
                        },
                    ],
                },
            },
        },
        attachments: [String],
        viewCount: { type: Number, default: 0 },
        isAutoExpired: Boolean,
        cancellationReason: String,
        completedAt: Date,
        serviceAddressId: { type: Types.ObjectId },
    },
    { timestamps: true }
);

ServiceRequestSchema.index({ status: 1, expiresAt: 1 });
ServiceRequestSchema.index({ 'lifecycle.order.providerId': 1, status: 1 });
ServiceRequestSchema.index({ location: '2dsphere' });

export const ServiceRequest = model('ServiceRequest', ServiceRequestSchema);
```

---

## `user.schema.ts`

```typescript
import { Schema, model } from 'mongoose';
import { pointDefinition } from './common/geo';
import type { UserDoc } from '../interfaces/user.interface';

const AddressSchema = new Schema(
    {
        addressType: {
            type: String,
            enum: ['home', 'work', 'personal', 'other', 'farm', 'warehouse', 'service_area', 'delivery_point', 'meeting_spot'],
            required: true,
        },
        customLabel: String,
        addressLine1: { type: String, required: true },
        addressLine2: String,
        village: String,
        tehsil: String,
        district: String,
        state: String,
        pincode: { type: String },
        location: { type: pointDefinition, index: '2dsphere' },
        accuracy: Number,
        isDefault: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        isVerified: { type: Boolean, default: false },
        accessInstructions: String,
        serviceCategories: [{ type: Schema.Types.ObjectId, ref: 'Catalogue' }],
        lastUsedAt: Date,
        usageCount: { type: Number, default: 0 },
    },
    { _id: true, timestamps: true }
);

const RatingSummarySchema = new Schema(
    {
        averageScore: Number,
        totalReviews: Number,
        distribution: { type: Map, of: Number },
    },
    { _id: false }
);

const UserSchema = new Schema<UserDoc>(
    {
        name: { type: String, required: true },
        email: { type: String },
        phone: { type: String, required: true, index: true },
        profilePictureKey: { type: String },
        role: {
            type: String,
            enum: ['individual', 'SHG', 'FPO', 'admin'],
            required: true,
            default: 'individual',
        },
        isVerified: { type: Boolean, default: false },
        kycStatus: {
            type: String,
            enum: ['none', 'pending', 'approved', 'rejected'],
            default: 'none',
        },
        preferences: {
            defaultLandingPage: {
                type: String,
                enum: ['provider', 'seeker'],
                default: 'seeker',
            },
            defaultProviderTab: { type: String, default: 'listings' },
            preferredLanguage: String,
            notificationsEnabled: { type: Boolean, default: true },
        },
        addresses: [AddressSchema],
        defaultAddressId: { type: Schema.Types.ObjectId },
        serviceRadius: Number,
        serviceCategories: [{ type: Schema.Types.ObjectId, ref: 'Catalogue' }],
        qualityScore: { type: Number, default: 0 },
        ratingSummary: {
            asProvider: RatingSummarySchema,
            asSeeker: RatingSummarySchema,
        },
        recentRatings: [
            {
                orderId: { type: Schema.Types.ObjectId },
                from: { type: Schema.Types.ObjectId, ref: 'User' },
                score: Number,
                review: String,
                createdAt: Date,
            },
        ],
    },
    { timestamps: true }
);

export const User = model('User', UserSchema);
```

---

## `common/geo.ts`

```typescript
export type GeoPoint = {
    type: 'Point';
    // [lng, lat]
    coordinates: [number, number];
};

// Reusable Mongoose schema definition for a GeoJSON Point
export const pointDefinition = {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
        type: [Number],
        required: true,
        validate: {
            validator: (v: number[]) =>
                Array.isArray(v) &&
                v.length === 2 &&
                // lng
                v[0] >= -180 &&
                v[0] <= 180 &&
                // lat
                v[1] >= -90 &&
                v[1] <= 90,
            message: 'coordinates must be [lng, lat] with lng in [-180,180] and lat in [-90,90]',
        },
    },
} as const;

export const isValidLng = (lng: number) => Number.isFinite(lng) && lng >= -180 && lng <= 180;
export const isValidLat = (lat: number) => Number.isFinite(lat) && lat >= -90 && lat <= 90;
export const isValidLngLat = (lng: number, lat: number) => isValidLng(lng) && isValidLat(lat);

export function makePoint(lng: number, lat: number): GeoPoint {
    if (!isValidLngLat(lng, lat)) {
        throw new Error('Invalid coordinates: require [lng, lat] with lng in [-180,180], lat in [-90,90]');
    }
    return { type: 'Point', coordinates: [lng, lat] };
}
```
