import {
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
  IsUrl,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  username!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bio!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  city!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  interest!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pronouns!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @IsUrl()
  avatarUrl!: string;
}