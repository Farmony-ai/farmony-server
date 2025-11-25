import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { GeoPointDto } from '../../../common/geo/geo.dto';

export type MatchRequestDocument = MatchRequest & Document;

@Schema({ collection: 'match_requests', timestamps: { createdAt: 'createdAt', updatedAt: false } })
export class MatchRequest {
  @Prop({ type: String, required: true })
  _id!: string; // UUID

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  seekerId?: Types.ObjectId | null; // Optional if unauthenticated

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: { type: [Number], required: true },
  })
  user_point!: GeoPointDto;

  @Prop({ type: Types.ObjectId, ref: 'Catalogue', required: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 100 })
  limit_n!: number;

  @Prop({ type: String, enum: ['CREATED', 'NO_COVERAGE', 'ERROR'], required: true })
  status!: string;

  @Prop({ type: String })
  idempotency_key?: string | null;

  // Docs-compliant fields (virtuals): userPoint, limitN, idempotencyKey, expiresAt
}

export const MatchRequestSchema = SchemaFactory.createForClass(MatchRequest);
// 2dsphere index on the GeoJSON point
MatchRequestSchema.index({ user_point: '2dsphere' });
MatchRequestSchema.index({ seekerId: 1 });
MatchRequestSchema.index({ categoryId: 1 });
MatchRequestSchema.index({ idempotency_key: 1 }, { unique: true, sparse: true });

// Virtuals to align with docs naming
MatchRequestSchema.virtual('userPoint')
  .get(function (this: any) { return this.user_point; })
  .set(function (this: any, v: any) { this.user_point = v; });

MatchRequestSchema.virtual('limitN')
  .get(function (this: any) { return this.limit_n; })
  .set(function (this: any, v: any) { this.limit_n = v; });

MatchRequestSchema.virtual('idempotencyKey')
  .get(function (this: any) { return this.idempotency_key; })
  .set(function (this: any, v: any) { this.idempotency_key = v; });

// TTL support per docs
// Add expiresAt with relaxed typing for Mongoose
(MatchRequestSchema as any).add({ expiresAt: { type: Date, index: true } });
MatchRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
