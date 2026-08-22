import {IsMobilePhone,IsNotEmpty,IsString,} 
from 'class-validator';


/*class LoginDto {
 mobileNumber: string;
 password: string;
 then login otp verification
}*/

export class LoginDto {
  @IsMobilePhone('en-IN')
  mobileNumber!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}