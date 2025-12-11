import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
    @Prop({ type: [{ type: Types.ObjectId, ref: 'User', required: true }] })
    participants: Types.ObjectId[];

    @Prop({ type: Types.ObjectId, ref: 'Order' })
    relatedOrderId?: Types.ObjectId;

    @Prop({ type: Date, default: Date.now, index: true })
    lastActivity: Date;

    @Prop({ type: Map, of: Date, default: {} })
    lastReadBy: Map<string, Date>;

    @Prop({ type: Map, of: Number, default: {} })
    unreadCount: Map<string, number>;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ relatedOrderId: 1 });
ConversationSchema.index({ lastActivity: -1 });

