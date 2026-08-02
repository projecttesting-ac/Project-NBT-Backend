import {
  IsMobilePhone,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class LoginDto {
  @IsMobilePhone('en-IN')
  mobileNumber!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}