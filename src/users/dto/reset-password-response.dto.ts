import { ApiProperty } from "@nestjs/swagger";

export class ResetPasswordResponseDto {
    @ApiProperty({ description: 'Mensagem de sucesso' })
    message: string;
}