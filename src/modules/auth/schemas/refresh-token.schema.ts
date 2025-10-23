import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({ required: true })
  issuedAt: Date;

  @Prop({ default: false, index: true })
  isRevoked: boolean;

  @Prop({ index: true })
  family?: string; // UUID to group related tokens for rotation tracking

  @Prop({ type: Object })
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
  };

  @Prop()
  revokedAt?: Date;

  @Prop()
  replacedBy?: string; // Track token rotation chain
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Add compound index for efficient queries
RefreshTokenSchema.index({ userId: 1, isRevoked: 1 });
RefreshTokenSchema.index({ family: 1, isRevoked: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }); // For cleanup cron
