import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { FirebaseAuthGuard } from '../../../identity/guards/firebase-auth.guard';
import { NotificationService } from '../services/notification.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('notifications')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    @Get()
    @ApiOperation({ summary: 'Get user notifications with pagination' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
    async getNotifications(
        @Req() req: any,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
        @Query('unreadOnly') unreadOnly: string = 'false',
    ) {
        const userId = req.user.userId || req.user.uid || req.user._id?.toString();
        return this.notificationService.getUserNotifications(userId, {
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 20,
            unreadOnly: unreadOnly === 'true',
        });
    }

    @Get('unread-count')
    @ApiOperation({ summary: 'Get unread notification count' })
    async getUnreadCount(@Req() req: any) {
        const userId = req.user.userId || req.user.uid || req.user._id?.toString();
        return this.notificationService.getUnreadCount(userId);
    }

    @Post(':id/read')
    @ApiOperation({ summary: 'Mark notification as read' })
    async markAsRead(@Req() req: any, @Param('id') notificationId: string) {
        const userId = req.user.userId || req.user.uid || req.user._id?.toString();
        return this.notificationService.markAsRead(userId, notificationId);
    }

    @Post('read-all')
    @ApiOperation({ summary: 'Mark all notifications as read' })
    async markAllAsRead(@Req() req: any) {
        const userId = req.user.userId || req.user.uid || req.user._id?.toString();
        return this.notificationService.markAllAsRead(userId);
    }
}
