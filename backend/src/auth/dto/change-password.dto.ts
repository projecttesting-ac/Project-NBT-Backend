import {IsNotEmpty,MinLength,} 
from 'class-validator';

/*class ChangePasswordDto {
 currentPassword: string;
 newPassword: string;
 confirmPassword: string;
}*/

export class ChangePasswordDto {
  @IsNotEmpty()
  currentPassword!: string;

  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;

  @IsNotEmpty()
  confirmPassword!: string;
}