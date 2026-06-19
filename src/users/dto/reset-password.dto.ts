import {IsEmail, IsOptional, IsString, IsUUID } from "class-validator";

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}