import { ApiProperty } from '@nestjs/swagger';
import { AutoCompleteDurationUnit } from '../../../generated/prisma/client';

export class RequestAutoCompleteSettingsResponseDto {
  @ApiProperty({ example: '0 3 * * *' })
  cronExpression: string;

  @ApiProperty({ example: 7 })
  durationValue: number;

  @ApiProperty({ enum: AutoCompleteDurationUnit, example: AutoCompleteDurationUnit.DAYS })
  durationUnit: AutoCompleteDurationUnit;

  @ApiProperty()
  updatedAt: Date;
}
