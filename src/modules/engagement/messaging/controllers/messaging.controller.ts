import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MessagingService } from '../services/messaging.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { FirebaseAuthGuard } from '../../../identity/guards/firebase-auth.guard';
import { CurrentUser } from '../../../identity/decorators/current-user.decorator';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(FirebaseAuthGuard)
export class MessagingController {
    constructor(private readonly messagingService: MessagingService) {}

    @Get()
    @ApiOperation({ summary: 'Get all conversations for current user' })
    @ApiResponse({ status: 200, description: 'Conversations retrieved successfully' })
    async getConversations(@CurrentUser('userId') userId: string) {
        const conversations = await this.messagingService.getUserConversations(userId);
        return {
            success: true,
            data: conversations,
        };
    }

    @Post()
    @ApiOperation({ summary: 'Create or get existing conversation' })
    @ApiResponse({ status: 201, description: 'Conversation created or retrieved' })
    async createConversation(
        @CurrentUser('userId') userId: string,
        @Body() dto: CreateConversationDto,
    ) {
        
        if (!userId) {
            throw new Error('User ID not found in request. Authentication may have failed.');
        }
        
                
        console.log('[MessagingController] createConversation called with:', {
            userId,
            userIdType: typeof userId,
            participantId: dto.participantId,
            participantIdType: typeof dto.participantId,
            orderId: dto.orderId,
            orderIdType: typeof dto.orderId,
        });
        
        try {
            const conversation = await this.messagingService.createOrGetConversation(userId, dto);
            return {
                success: true,
                data: conversation,
            };
        } catch (error: any) {
            console.error('[MessagingController] Error creating conversation:', error);
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get conversation by ID' })
    @ApiResponse({ status: 200, description: 'Conversation retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Conversation not found' })
    async getConversation(
        @Param('id') conversationId: string,
        @CurrentUser('userId') userId: string,
    ) {
        const conversation = await this.messagingService.getConversationById(conversationId, userId);
        return {
            success: true,
            data: conversation,
        };
    }

    @Get(':id/messages')
    @ApiOperation({ summary: 'Get messages for a conversation' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of messages to retrieve' })
    @ApiQuery({ name: 'before', required: false, type: String, description: 'Get messages before this date (ISO string)' })
    @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
    async getMessages(
        @Param('id') conversationId: string,
        @CurrentUser('userId') userId: string,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
        @Query('before') before?: string,
    ) {
        const beforeDate = before ? new Date(before) : undefined;
        const result = await this.messagingService.getMessages(conversationId, userId, limit, beforeDate);
        return {
            success: true,
            data: result,
        };
    }

    @Post(':id/messages')
    @ApiOperation({ summary: 'Send a message' })
    @ApiResponse({ status: 201, description: 'Message sent successfully' })
    async sendMessage(
        @Param('id') conversationId: string,
        @CurrentUser('userId') userId: string,
        @Body() dto: CreateMessageDto,
    ) {
        const message = await this.messagingService.sendMessage(conversationId, userId, dto);
        return {
            success: true,
            data: message,
        };
    }

    @Post(':id/read')
    @ApiOperation({ summary: 'Mark conversation as read' })
    @ApiResponse({ status: 200, description: 'Conversation marked as read' })
    async markAsRead(
        @Param('id') conversationId: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.messagingService.markAsRead(conversationId, userId);
        return {
            success: true,
            message: 'Conversation marked as read',
        };
    }
}

