import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { AutoCompleteDurationUnit } from '../../../generated/prisma/client';

export class UpdateRequestAutoCompleteSettingsDto {
  @ApiPropertyOptional({
    example: '*/10 * * * *',
    description: 'Expressão cron (minuto hora dia mês dia-da-semana)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cronExpression?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationValue?: number;

  @ApiPropertyOptional({ enum: AutoCompleteDurationUnit })
  @IsOptional()
  @IsEnum(AutoCompleteDurationUnit)
  durationUnit?: AutoCompleteDurationUnit;
}
