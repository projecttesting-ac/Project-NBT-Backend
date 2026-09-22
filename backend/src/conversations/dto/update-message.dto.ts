import {
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';

import { MessageMentionDto } from './message-mention.dto';

export class UpdateMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsArray()
  mentions?: MessageMentionDto[];
}