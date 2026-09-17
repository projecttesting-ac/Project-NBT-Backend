import {
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

export class ForgotPasswordDto {
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
}