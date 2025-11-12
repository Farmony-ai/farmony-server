import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatchCandidateDocument = MatchCandidate & Document;

@Schema({ collection: 'match_candidates', timestamps: false })
export class MatchCandidate {
  @Prop({ type: String, required: true, index: true })
  request_id!: string; // UUID reference to MatchRequest

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  provider_id!: Types.ObjectId; // Reference to User with provider role

  @Prop({ type: Number, required: true })
  distance_m!: number;

  @Prop({ type: Number, required: true })
  rank_order!: number;
}

export const MatchCandidateSchema = SchemaFactory.createForClass(MatchCandidate);
MatchCandidateSchema.index({ request_id: 1, rank_order: 1 });
MatchCandidateSchema.index({ provider_id: 1 });

