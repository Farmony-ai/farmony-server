import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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
  user_point!: { type: 'Point'; coordinates: [number, number] };

  @Prop({ type: Types.ObjectId, ref: 'Catalogue', required: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 100 })
  limit_n!: number;

  @Prop({ type: String, enum: ['CREATED', 'NO_COVERAGE', 'ERROR'], required: true })
  status!: string;

  @Prop({ type: String })
  idempotency_key?: string | null;
}

export const MatchRequestSchema = SchemaFactory.createForClass(MatchRequest);
// 2dsphere index on the GeoJSON point
MatchRequestSchema.index({ user_point: '2dsphere' });
MatchRequestSchema.index({ seekerId: 1 });
MatchRequestSchema.index({ categoryId: 1 });
MatchRequestSchema.index({ idempotency_key: 1 }, { unique: true, sparse: true });
