import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

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
}