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
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getConversations(
  @CurrentUser() user: any,
) {
  console.log('Logged in user:', user);

  return this.conversationsService.getConversations(user.id);
}
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
}