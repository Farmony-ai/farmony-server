import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { ConversationBucket, ConversationBucketDocument, Message } from '../schemas/conversation-bucket.schema';
import { CreateMessageDto } from '../dto/create-message.dto';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { FirebaseStorageService } from '../../../common/firebase/firebase-storage.service';

const MESSAGES_PER_BUCKET = 1000;

@Injectable()
export class MessagingService {
    private readonly logger = new Logger(MessagingService.name);

    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        @InjectModel(ConversationBucket.name)
        private readonly bucketModel: Model<ConversationBucketDocument>,
        private readonly storageService: FirebaseStorageService,
    ) {}

   
    async createOrGetConversation(userId: string, dto: CreateConversationDto): Promise<any> {
        try {
            this.logger.log(`createOrGetConversation called with userId: ${userId} (type: ${typeof userId}), participantId: ${dto.participantId} (type: ${typeof dto.participantId}), orderId: ${dto.orderId} (type: ${typeof dto.orderId})`);
            
            if (!userId || (typeof userId !== 'string' && typeof userId !== 'object')) {
                this.logger.error(`Invalid userId: ${userId} (type: ${typeof userId})`);
                throw new BadRequestException(`Invalid user ID: ${userId}`);
            }
            
            const userIdStr = typeof userId === 'string' ? userId.trim() : String(userId).trim();
            
            const participantIdStr = typeof dto.participantId === 'string' 
                ? dto.participantId.trim() 
                : String(dto.participantId).trim();
            const orderIdStr = dto.orderId 
                ? (typeof dto.orderId === 'string' ? dto.orderId.trim() : String(dto.orderId).trim())
                : undefined;

            if (!Types.ObjectId.isValid(userIdStr)) {
                this.logger.error(`Invalid userId format: ${userIdStr}`);
                throw new BadRequestException(`Invalid user ID format: ${userIdStr}`);
            }

            if (!Types.ObjectId.isValid(participantIdStr)) {
                this.logger.error(`Invalid participantId format: ${participantIdStr}`);
                throw new BadRequestException(`Invalid participant ID format: ${participantIdStr}`);
            }

            if (orderIdStr && !Types.ObjectId.isValid(orderIdStr)) {
                this.logger.warn(`Invalid orderId format: ${orderIdStr}, ignoring orderId`);
            }

            let participantId: Types.ObjectId;
            let currentUserId: Types.ObjectId;
            
            try {
                participantId = new Types.ObjectId(participantIdStr);
            } catch (error) {
                this.logger.error(`Failed to create ObjectId from participantId: ${participantIdStr}`, error);
                throw new BadRequestException(`Invalid participant ID format: ${participantIdStr}`);
            }
            
            try {
                currentUserId = new Types.ObjectId(userIdStr);
            } catch (error) {
                this.logger.error(`Failed to create ObjectId from userId: ${userIdStr}`, error);
                throw new BadRequestException(`Invalid user ID format: ${userIdStr}`);
            }

            if (participantId.equals(currentUserId)) {
                throw new BadRequestException('Cannot create conversation with yourself');
            }

            const query: any = {
                participants: { $all: [currentUserId, participantId] },
            };
            
            if (orderIdStr && Types.ObjectId.isValid(orderIdStr)) {
                query.relatedOrderId = new Types.ObjectId(orderIdStr);
            } else if (orderIdStr) {
                this.logger.warn(`Invalid orderId provided: ${orderIdStr}, searching without orderId filter`);
            }

            let conversation = await this.conversationModel
                .findOne(query)
                .populate('participants', 'name profilePictureKey phone')
                .populate('relatedOrderId')
                .lean();

            if (!conversation) {
                const newConversation = new this.conversationModel({
                    participants: [currentUserId, participantId],
                    relatedOrderId: orderIdStr && Types.ObjectId.isValid(orderIdStr) ? new Types.ObjectId(orderIdStr) : undefined,
                    lastActivity: new Date(),
                    lastReadBy: new Map(),
                    unreadCount: new Map([
                        [currentUserId.toString(), 0],
                        [participantId.toString(), 0],
                    ]),
                });

                const saved = await newConversation.save();
                
                conversation = await this.conversationModel
                    .findById(saved._id)
                    .populate('participants', 'name profilePictureKey phone')
                    .populate('relatedOrderId')
                    .lean();

                if (!conversation) {
                    throw new NotFoundException('Failed to retrieve created conversation');
                }
            }

            if (!conversation.participants || conversation.participants.length === 0) {
                throw new BadRequestException('Conversation has no participants');
            }

            const participants = conversation.participants.map((p: any) => ({
                ...p,
                profilePictureUrl: p.profilePictureKey ? this.storageService.getPublicUrl(p.profilePictureKey) : null,
            }));
            const otherParticipant = participants.find((p: any) => p._id.toString() !== userIdStr);
            
            if (!otherParticipant) {
                this.logger.warn(`Could not find other participant in conversation ${conversation._id} for user ${userIdStr}`);
            }
            
            return {
                ...conversation,
                _id: conversation._id?.toString() || conversation._id,
                participants,
                otherParticipant,
            };
        } catch (error: any) {
            this.logger.error(`Error in createOrGetConversation: ${error.message}`, error.stack);
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(`Failed to create or get conversation: ${error.message}`);
        }
    }


    async createConversationForOrder(orderId: string, seekerId: string, providerId: string): Promise<any> {
        const seekerObjectId = new Types.ObjectId(seekerId);
        const providerObjectId = new Types.ObjectId(providerId);
        const orderObjectId = new Types.ObjectId(orderId);

        const existing = await this.conversationModel
            .findOne({
                participants: { $all: [seekerObjectId, providerObjectId] },
                relatedOrderId: orderObjectId,
            })
            .populate('participants', 'name profilePictureKey phone')
            .populate('relatedOrderId')
            .lean();

        if (existing) {
            const participants = existing.participants.map((p: any) => ({
                ...p,
                profilePictureUrl: p.profilePictureKey ? this.storageService.getPublicUrl(p.profilePictureKey) : null,
            }));
            const otherParticipant = participants.find((p: any) => p._id.toString() !== seekerId);
            return {
                ...existing,
                participants,
                otherParticipant,
            };
        }

        const conversation = new this.conversationModel({
            participants: [seekerObjectId, providerObjectId],
            relatedOrderId: orderObjectId,
            lastActivity: new Date(),
            lastReadBy: new Map(),
            unreadCount: new Map([
                [seekerId, 0],
                [providerId, 0],
            ]),
        });

        const saved = await conversation.save();

        const populated = await this.conversationModel
            .findById(saved._id)
            .populate('participants', 'name profilePictureKey phone')
            .populate('relatedOrderId')
            .lean();

        const participants = populated.participants.map((p: any) => ({
            ...p,
            profilePictureUrl: p.profilePictureKey ? this.storageService.getPublicUrl(p.profilePictureKey) : null,
        }));
        const otherParticipant = participants.find((p: any) => p._id.toString() !== seekerId);

        return {
            ...populated,
            participants,
            otherParticipant,
        };
    }

    async getUserConversations(userId: string): Promise<any[]> {
        const conversations = await this.conversationModel
            .find({ participants: new Types.ObjectId(userId) })
            .populate('participants', 'name profilePictureKey phone')
            .populate('relatedOrderId', 'status totalAmount serviceStartDate')
            .sort({ lastActivity: -1 })
            .lean();

        return conversations.map((conv: any) => {
            const participants = conv.participants.map((p: any) => ({
                _id: p._id,
                name: p.name,
                profilePictureKey: p.profilePictureKey,
                profilePictureUrl: p.profilePictureKey ? this.storageService.getPublicUrl(p.profilePictureKey) : null,
                phone: p.phone,
            }));
            const otherParticipant = participants.find((p: any) => p._id.toString() !== userId);
            return {
                _id: conv._id,
                participants,
                otherParticipant,
                relatedOrderId: conv.relatedOrderId,
                lastActivity: conv.lastActivity,
                unreadCount: conv.unreadCount?.get?.(userId) || 0,
                lastReadAt: conv.lastReadBy?.get?.(userId),
            };
        });
    }

    async getConversationById(conversationId: string, userId: string): Promise<any> {
        const conversation = await this.conversationModel
            .findById(conversationId)
            .populate('participants', 'name profilePictureKey phone')
            .populate('relatedOrderId')
            .lean();

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        const userIdObj = new Types.ObjectId(userId);
        const isParticipant = conversation.participants.some(
            (p: any) => new Types.ObjectId(p._id).equals(userIdObj)
        );

        if (!isParticipant) {
            throw new ForbiddenException('You do not have access to this conversation');
        }

        const participants = conversation.participants.map((p: any) => ({
            ...p,
            profilePictureUrl: p.profilePictureKey ? this.storageService.getPublicUrl(p.profilePictureKey) : null,
        }));
        const otherParticipant = participants.find((p: any) => p._id.toString() !== userId);
        return {
            ...conversation,
            _id: conversation._id?.toString() || conversation._id,
            participants,
            otherParticipant,
        };
    }

    async getMessages(conversationId: string, userId: string, limit: number = 50, before?: Date): Promise<any> {
        await this.getConversationById(conversationId, userId);

        const query: any = { conversationId: new Types.ObjectId(conversationId) };
        if (before) {
            query['messages.sentAt'] = { $lt: before };
        }

        const buckets = await this.bucketModel
            .find(query)
            .sort({ bucketNumber: -1 })
            .lean();

        let allMessages: any[] = [];
        for (const bucket of buckets) {
            const bucketMessages = (bucket.messages || []).map((msg: any) => {
                // Ensure senderId is stringified
                const senderIdStr = msg.senderId?.toString ? msg.senderId.toString() : String(msg.senderId);
                // Ensure sentAt is ISO string
                const sentAtStr = msg.sentAt?.toISOString ? msg.sentAt.toISOString() : (typeof msg.sentAt === 'string' ? msg.sentAt : new Date(msg.sentAt).toISOString());
                // Generate consistent _id
                const msgId = msg._id || `${bucket._id.toString()}-${sentAtStr}`;
                
                return {
                    ...msg,
                    _id: msgId,
                    senderId: senderIdStr,
                    sentAt: sentAtStr,
                    bucketNumber: bucket.bucketNumber,
                };
            });
            allMessages = allMessages.concat(bucketMessages);
        }

        allMessages.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

        if (before) {
            allMessages = allMessages.filter((msg) => new Date(msg.sentAt) < before);
        }
        allMessages = allMessages.slice(0, limit);

        allMessages.reverse();

        return {
            messages: allMessages,
            hasMore: allMessages.length === limit,
        };
    }

    async sendMessage(conversationId: string, userId: string, dto: CreateMessageDto): Promise<any> {
        const conversation = await this.getConversationById(conversationId, userId);

        const senderId = new Types.ObjectId(userId);
        const now = new Date();

        const latestBucket = await this.bucketModel
            .findOne({ conversationId: new Types.ObjectId(conversationId) })
            .sort({ bucketNumber: -1 })
            .exec();

        let bucket: ConversationBucketDocument;
        let bucketNumber = 0;

        if (latestBucket && latestBucket.messages.length < MESSAGES_PER_BUCKET) {
            bucket = latestBucket;
            bucketNumber = latestBucket.bucketNumber;
        } else {
            bucketNumber = latestBucket ? latestBucket.bucketNumber + 1 : 0;
            bucket = new this.bucketModel({
                conversationId: new Types.ObjectId(conversationId),
                bucketNumber,
                messages: [],
                firstMessageAt: now,
                lastMessageAt: now,
            });
        }

        const message: Message = {
            senderId,
            text: dto.message,
            sentAt: now,
            isRead: false,
        };

        bucket.messages.push(message);
        bucket.lastMessageAt = now;
        if (!bucket.firstMessageAt) {
            bucket.firstMessageAt = now;
        }

        await bucket.save();

        const otherParticipantId = conversation.participants
            .find((p: any) => p._id.toString() !== userId)?._id?.toString();

        if (otherParticipantId) {
            const currentUnread = conversation.unreadCount?.get?.(otherParticipantId) || 0;
            await this.conversationModel.findByIdAndUpdate(conversationId, {
                $set: {
                    lastActivity: now,
                    [`unreadCount.${otherParticipantId}`]: currentUnread + 1,
                },
            });
        }

        const messageId = `${bucket._id.toString()}-${now.getTime()}`;
        return {
            text: message.text,
            _id: messageId,
            senderId: message.senderId.toString(),
            sentAt: message.sentAt.toISOString(),
            isRead: message.isRead || false,
            readAt: message.readAt ? message.readAt.toISOString() : undefined,
        } as any;
    }

    async markAsRead(conversationId: string, userId: string): Promise<void> {
        await this.getConversationById(conversationId, userId);

        await this.conversationModel.findByIdAndUpdate(conversationId, {
            $set: {
                [`lastReadBy.${userId}`]: new Date(),
                [`unreadCount.${userId}`]: 0,
            },
        });

        const buckets = await this.bucketModel.find({
            conversationId: new Types.ObjectId(conversationId),
            'messages.senderId': { $ne: new Types.ObjectId(userId) },
            'messages.isRead': false,
        });

        for (const bucket of buckets) {
            let updated = false;
            for (const message of bucket.messages) {
                if (!message.senderId.equals(new Types.ObjectId(userId)) && !message.isRead) {
                    message.isRead = true;
                    message.readAt = new Date();
                    updated = true;
                }
            }
            if (updated) {
                await bucket.save();
            }
        }
    }
}

