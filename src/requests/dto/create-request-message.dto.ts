import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRequestMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @ApiProperty({ description: 'Conteúdo da mensagem', maxLength: 2000 })
  content: string;
}
