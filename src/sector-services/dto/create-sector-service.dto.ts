import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSectorserviceDto {
  @ApiProperty({
    description: 'O Nome do Serviço do Setor',
    example: 'Serviço 1',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Se o Serviço do Setor está ativo ou não',
    example: 'true',
  })
  @IsBoolean()
  @IsNotEmpty()
  active: boolean;
}
