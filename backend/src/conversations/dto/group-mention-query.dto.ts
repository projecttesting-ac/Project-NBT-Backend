import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class GroupMentionQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  query?: string;
}