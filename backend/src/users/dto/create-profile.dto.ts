
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProfileDto {
  @ApiProperty({
    example: 'john_doe',
    description:
      'Unique username using lowercase letters, numbers, and underscores.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Username can contain only lowercase letters, numbers, and underscores.',
  })
  username!: string;

  @ApiProperty({
    example: 'John Doe',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Za-z]+(?: [A-Za-z]+)+$/, {
    message:
      'Display name must contain at least a first name and last name.',
  })
  displayName!: string;

  @ApiProperty({
    example: 'Software developer and technology enthusiast.',
    maxLength: 300,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Matches(/\S/, {
    message: 'Bio cannot be empty.',
  })
  bio!: string;

  @ApiProperty({
    example: ['Technology', 'Programming'],
    type: [String],
    minItems: 1,
    maxItems: 20,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/\S/, {
    each: true,
    message: 'Interest cannot be empty.',
  })
  interest!: string[];

  @ApiProperty({
    example: 'He/Him',
    maxLength: 30,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/\S/, {
    message: 'Pronouns cannot be empty.',
  })
  pronouns!: string;

  @ApiProperty({
    example: '18/07/2004',
    description: 'Date of birth in DD/MM/YYYY format.',
  })
  @IsString()
  @Matches(/^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/, {
    message: 'Date of birth must use DD/MM/YYYY format.',
  })
  dateOfBirth!: string;

  @ApiProperty({
    example: 'Nashik',
    maxLength: 50,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/, {
    message: 'City must contain only letters, spaces, or hyphens.',
  })
  city!: string;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiProperty({
    example: 'https://example.com/cover.jpg',
    description: 'URL of the profile cover image.',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiProperty({
    example: 19.9975,
    description: 'Latitude between -90 and 90.',
    required: false,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({
    example: 73.7898,
    description: 'Longitude between -180 and 180.',
    required: false,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude?: number;
}
