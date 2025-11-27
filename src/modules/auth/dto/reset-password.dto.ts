import { IsPhoneNumber, IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @IsPhoneNumber('IN')
  phone: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}