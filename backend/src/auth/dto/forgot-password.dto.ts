import { IsNotEmpty, Matches } from 'class-validator';


/*class ForgotPasswordDto {
 mobileNumber: string;
 then otp verification
}*/

export class ForgotPasswordDto {
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
  message: 'Please enter a valid mobile number.',
})
mobileNumber!: string;
}