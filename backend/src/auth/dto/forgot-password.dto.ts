import { IsNotEmpty, Matches } from 'class-validator';

export class ForgotPasswordDto {
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Invalid mobile number.',
  })
  mobileNumber!: string;
}