import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class SignInResponseDto {
  @ApiProperty({
    description: 'Access token',
    example: 'token',
  })
  @IsString()
  @IsNotEmpty()
  access_token: string;
}