import { IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  resetToken!: string;

  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;

  @IsNotEmpty()
  confirmPassword!: string;
}