import {
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class ReactMessageDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'like',
    'love',
    'laugh',
    'wow',
    'sad',
    'angry',
  ])
  reaction!: string;
}