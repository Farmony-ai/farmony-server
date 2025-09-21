import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Auth') 
@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(@Body() dto: CreateMessageDto) {
    return this.messagesService.create(dto);
  }

  @Post('broadcast')
  broadcast(@Body() dto: CreateMessageDto) {
    return this.messagesService.broadcast(dto);
  }

  @Get()
  findMyMessages(
    @Request() req,
    @Query('unreadOnly') unreadOnly?: boolean
  ) {
    return this.messagesService.findByUser(req.user.userId, unreadOnly);
  }

  @Get('unread-count')
  getUnreadCount(@Request() req) {
    return this.messagesService.getUnreadCount(req.user.userId);
  }

  @Patch(':id/read')
  markAsRead(
    @Request() req,
    @Param('id') id: string
  ) {
    return this.messagesService.markAsRead(id, req.user.userId);
  }
}