import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

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
  // GET CONVERSATIONS
  // =========================

  @UseGuards(JwtAuthGuard)
  @Get()
  getConversations(
    @CurrentUser() user: any,
  ) {
    console.log('Logged in user:', user);

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
  sendMessage(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversationsService.sendMessage(
      user.id,
      conversationId,
      dto,
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
  async addReaction(
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
  async removeReaction(
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