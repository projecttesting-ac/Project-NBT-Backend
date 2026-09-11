import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Username can contain only lowercase letters, numbers, and underscores.',
  })
  username!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/.*\S.*/, {
    each: true,
    message: 'Interest cannot be empty.',
  })
  interest?: string[];

  @IsOptional()
  @IsString()
  pronouns?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/, {
    message:
      'City must contain only letters, spaces, or hyphens.',
  })
  city?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}