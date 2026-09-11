import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsUrl,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Za-z]+(?: [A-Za-z]+)+$/, {
  message:
    'Display name must contain at least a first name and last name.',
})
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Username can contain only lowercase letters, numbers, and underscores.',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/, {
    message:
      'City must contain only letters, spaces, or hyphens.',
  })
  city?: string;

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
  @MaxLength(20)
  pronouns?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}