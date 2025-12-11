import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationBucketDocument = ConversationBucket & Document;

@Schema({ _id: false })
export class Message {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    senderId: Types.ObjectId;

    @Prop({ type: String, required: true })
    text: string;

    @Prop({ type: Date, default: Date.now })
    sentAt: Date;

    @Prop({ type: Boolean, default: false })
    isRead: boolean;

    @Prop({ type: Date })
    readAt?: Date;
}

const MessageSchema = SchemaFactory.createForClass(Message);

@Schema({ timestamps: true })
export class ConversationBucket {
    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
    conversationId: Types.ObjectId;

    @Prop({ type: Number, required: true, default: 0 })
    bucketNumber: number;

    @Prop({ type: [MessageSchema], default: [] })
    messages: Message[];

    @Prop({ type: Date })
    firstMessageAt?: Date;

    @Prop({ type: Date })
    lastMessageAt?: Date;
}

export const ConversationBucketSchema = SchemaFactory.createForClass(ConversationBucket);

ConversationBucketSchema.index({ conversationId: 1, bucketNumber: 1 }, { unique: true });
ConversationBucketSchema.index({ conversationId: 1, 'messages.sentAt': -1 });

