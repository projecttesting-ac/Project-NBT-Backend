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
import { AddGroupMembersDto } from './dto/add-group-members.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupMentionQueryDto } from './dto/group-mention-query.dto';

import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })

  @Post('group')
  createGroup(
    @CurrentUser() user: any,
    @Body() dto: CreateGroupDto,
  ) {

    return this.conversationsService.createGroup(
      user.id,
      dto,
    );
  }

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

    // create the conversation and send the first message
    return this.conversationsService.createConversationAndSendMessage(
      user.id,
      targetUserId,
      dto,
      file,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getConversations(
    @CurrentUser() user: any,
    @Query() pagination: PaginationDto,
  ) {

    // get the user's conversations
    return this.conversationsService.getConversations(
      user.id,
      pagination,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })

  @Get(':conversationId/mention-users')
  getGroupMentionUsers(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Query() dto: GroupMentionQueryDto,
  ) {

    return this.conversationsService.getGroupMentionUsers(
      user.id,
      conversationId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })

  @Get(':conversationId/members')
  getGroupMembers(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {

    return this.conversationsService.getGroupMembers(
      user.id,
      conversationId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 120,
      ttl: 60 * 1000,
    },
  })
@UseGuards(JwtAuthGuard)
@Throttle({
  default: {
    limit: 20,
    ttl: 60 * 1000,
  },
})
@Post(':conversationId/members')
addGroupMembers(
  @CurrentUser() user: any,
  @Param('conversationId') conversationId: string,
  @Body() dto: AddGroupMembersDto,
) {
  return this.conversationsService.addGroupMembers(
    user.id,
    conversationId,
    dto,
  );
}
  @Get(':conversationId/messages')
  getMessages(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Query() pagination: PaginationDto,
  ) {

    // get messages from a conversation
    return this.conversationsService.getMessages(
      user.id,
      conversationId,
      pagination,
    );
  }

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

    // send a message with optional media
    return this.conversationsService.sendMessage(
      user.id,
      conversationId,
      dto,
      file,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':conversationId/read')
  markMessagesAsRead(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {

    // mark all messages as read
    return this.conversationsService.markMessagesAsRead(
      user.id,
      conversationId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':conversationId/messages/:messageId/delivered')
  markMessageAsDelivered(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {

    // mark the message as delivered
    return this.conversationsService.markMessageAsDelivered(
      user.id,
      conversationId,
      messageId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':conversationId/messages/:messageId/seen')
  markMessageAsSeen(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    
    // mark the message as seen
    return this.conversationsService.markMessageAsSeen(
      user.id,
      conversationId,
      messageId,
    );
  }

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

    // edit a message
    return this.conversationsService.updateMessage(
      user.id,
      conversationId,
      messageId,
      dto,
    );
  }

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

    // delete a message
    return this.conversationsService.deleteMessage(
      user.id,
      conversationId,
      messageId,
    );
  }

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

    // forward a message to another conversation
    return this.conversationsService.forwardMessage(
      user.id,
      conversationId,
      messageId,
      dto,
    );
  }

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

    // add or change a reaction
    return this.conversationsService.addReaction(
      user.id,
      conversationId,
      messageId,
      dto.reaction,
    );
  }

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

    // remove the reaction
    return this.conversationsService.removeReaction(
      user.id,
      conversationId,
      messageId,
    );
  }
}