import { IsNotEmpty, Matches } from 'class-validator';

export class ResendOtpDto {
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
  message: 'Please enter a valid mobile number.',
})
mobileNumber!: string;
}