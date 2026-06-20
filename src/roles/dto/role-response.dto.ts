import { ApiProperty } from '@nestjs/swagger';

export class RoleOptionResponseDto {
  @ApiProperty({ description: 'ID do cargo' })
  id: string;
  @ApiProperty({ description: 'Nome do cargo' })
  name: string;
  @ApiProperty({ description: 'Descrição do cargo' })
  description: string;
  @ApiProperty({ description: 'Slug do cargo' })
  slug: string;
}
