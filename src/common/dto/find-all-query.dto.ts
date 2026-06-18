import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class FindAllQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'A pesquisa deve ser uma string' })
  @ApiPropertyOptional({ description: 'Pesquisa por nome, email ou username' })
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'O isActive deve ser um booleano' })
  @ApiPropertyOptional({ description: 'Filtrar por status ativo/inativo' })
  isActive?: boolean;
}
