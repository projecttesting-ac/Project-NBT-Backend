import { IsNotEmpty, IsString } from 'class-validator';


/*class LogoutDto {
 refreshToken: string;
 logout button and then confirmation button
}*/

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}