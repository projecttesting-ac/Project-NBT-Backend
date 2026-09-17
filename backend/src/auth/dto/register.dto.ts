import {
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{0,3}$/, {
    message: 'Please select a valid country code.',
  })
  countryCode!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,15}$/, {
    message: 'Please enter a valid mobile number.',
  })
  mobileNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword!: string;
}