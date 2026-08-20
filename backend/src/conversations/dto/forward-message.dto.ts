import { IsNotEmpty, IsUUID } from 'class-validator';

export class ForwardMessageDto {
  @IsUUID()
  @IsNotEmpty()
  targetConversationId!: string;
}