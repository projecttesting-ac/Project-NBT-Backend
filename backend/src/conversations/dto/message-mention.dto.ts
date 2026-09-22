import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class MessageMentionDto {
  @IsUUID('4')
  userId!: string;

  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}