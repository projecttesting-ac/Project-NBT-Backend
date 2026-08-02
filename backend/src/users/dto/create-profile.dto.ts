import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @MaxLength(100)
  fullName!: string;



  @IsString()
  @MaxLength(30)
  username!: string;

  @IsString()
  @MaxLength(50)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsString()
  interest?: string;

  @IsOptional()
  @IsString()
  pronouns?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}