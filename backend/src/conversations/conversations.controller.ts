import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';

import { ConversationsService } from './conversations.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';

import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  // =========================================================
  // CREATE CONVERSATION + SEND MESSAGE + OPTIONAL MEDIA
  // 120 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 120,
      ttl: 60 * 1000,
    },
  })
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

  // =========================================================
  // GET CONVERSATIONS
  // Global authenticated fallback: 100 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get()
  getConversations(
    @CurrentUser() user: any,
    @Query() pagination: PaginationDto,
  ) {
    return this.conversationsService.getConversations(
      user.id,
      pagination,
    );
  }

  // =========================================================
  // GET MESSAGES
  // 120 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 120,
      ttl: 60 * 1000,
    },
  })
  @Get(':conversationId/messages')
  getMessages(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.conversationsService.getMessages(
      user.id,
      conversationId,
      pagination,
    );
  }

  // =========================================================
  // SEND MESSAGE
  // 120 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 120,
      ttl: 60 * 1000,
    },
  })
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

  // =========================================================
  // MARK ALL MESSAGES AS READ
  // Global authenticated fallback: 100 requests / 1 minute
  // =========================================================

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

  // =========================================================
  // MARK MESSAGE AS DELIVERED
  // Global authenticated fallback: 100 requests / 1 minute
  // =========================================================

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

  // =========================================================
  // MARK MESSAGE AS SEEN
  // Global authenticated fallback: 100 requests / 1 minute
  // =========================================================

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

  // =========================================================
  // UPDATE MESSAGE
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
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

  // =========================================================
  // DELETE MESSAGE
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
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

  // =========================================================
  // FORWARD MESSAGE
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
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

  // =========================================================
  // ADD / CHANGE REACTION
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
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

  // =========================================================
  // REMOVE REACTION
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
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