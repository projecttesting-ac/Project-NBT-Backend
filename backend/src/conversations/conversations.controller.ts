import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  // =========================
  // CREATE CONVERSATION + SEND MESSAGE + OPTIONAL MEDIA
  // =========================

  @UseGuards(JwtAuthGuard)
  @Post(':targetUserId')
  @UseInterceptors(FileInterceptor('file'))
  createConversation(
    @CurrentUser() user: any,
    @Param('targetUserId') targetUserId: string,
    @Body() dto: SendMessageDto,
    @UploadedFile() file: any,
  ) {
    return this.conversationsService.createConversationAndSendMessage(
      user.id,
      targetUserId,
      dto,
      file,
    );
  }

  // =========================
  // GET CONVERSATIONS
  // =========================

  @UseGuards(JwtAuthGuard)
  @Get()
  getConversations(
    @CurrentUser() user: any,
  ) {
    return this.conversationsService.getConversations(
      user.id,
    );
  }

  // =========================
  // GET MESSAGES
  // =========================

  @UseGuards(JwtAuthGuard)
  @Get(':conversationId/messages')
  getMessages(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.getMessages(
      user.id,
      conversationId,
    );
  }

  // =========================
  // SEND MESSAGE
  // =========================

  @UseGuards(JwtAuthGuard)
  @Post(':conversationId/messages')
  @UseInterceptors(FileInterceptor('file'))
  sendMessage(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
    @UploadedFile() file: any,
  ) {
    return this.conversationsService.sendMessage(
      user.id,
      conversationId,
      dto,
      file,
    );
  }

  // =========================
  // MARK ALL MESSAGES AS READ
  // =========================

  @UseGuards(JwtAuthGuard)
  @Patch(':conversationId/read')
  markMessagesAsRead(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.markMessagesAsRead(
      user.id,
      conversationId,
    );
  }

  // =========================
  // MARK MESSAGE AS DELIVERED
  // =========================

  @UseGuards(JwtAuthGuard)
  @Patch(':conversationId/messages/:messageId/delivered')
  markMessageAsDelivered(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.conversationsService.markMessageAsDelivered(
      user.id,
      conversationId,
      messageId,
    );
  }

  // =========================
  // MARK MESSAGE AS SEEN
  // =========================

  @UseGuards(JwtAuthGuard)
  @Patch(':conversationId/messages/:messageId/seen')
  markMessageAsSeen(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.conversationsService.markMessageAsSeen(
      user.id,
      conversationId,
      messageId,
    );
  }

  // =========================
  // UPDATE MESSAGE
  // =========================

  @UseGuards(JwtAuthGuard)
  @Patch(':conversationId/messages/:messageId')
  updateMessage(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.conversationsService.updateMessage(
      user.id,
      conversationId,
      messageId,
      dto,
    );
  }

  // =========================
  // DELETE MESSAGE
  // =========================

  @UseGuards(JwtAuthGuard)
  @Delete(':conversationId/messages/:messageId')
  deleteMessage(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.conversationsService.deleteMessage(
      user.id,
      conversationId,
      messageId,
    );
  }

  // =========================
  // FORWARD MESSAGE
  // =========================

  @UseGuards(JwtAuthGuard)
  @Post(':conversationId/messages/:messageId/forward')
  forwardMessage(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: ForwardMessageDto,
  ) {
    return this.conversationsService.forwardMessage(
      user.id,
      conversationId,
      messageId,
      dto,
    );
  }

  // =========================
  // ADD / CHANGE REACTION
  // =========================

  @UseGuards(JwtAuthGuard)
  @Post(':conversationId/messages/:messageId/reaction')
  addReaction(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: ReactMessageDto,
  ) {
    return this.conversationsService.addReaction(
      user.id,
      conversationId,
      messageId,
      dto.reaction,
    );
  }

  // =========================
  // REMOVE REACTION
  // =========================

  @UseGuards(JwtAuthGuard)
  @Delete(':conversationId/messages/:messageId/reaction')
  removeReaction(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.conversationsService.removeReaction(
      user.id,
      conversationId,
      messageId,
    );
  }
}