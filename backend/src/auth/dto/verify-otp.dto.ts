import {
  IsMobilePhone,
  IsNotEmpty,
  Length,
} from 'class-validator';

export class VerifyOtpDto {
  @IsMobilePhone('en-IN')
  mobileNumber!: string;

  @IsNotEmpty()
  @Length(4, 4)
  otp!: string;
}