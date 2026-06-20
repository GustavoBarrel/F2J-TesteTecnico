import { ApiProperty } from '@nestjs/swagger';
import { AutoCompleteDurationUnit } from '../../../generated/prisma/client';

export class CronPresetDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  cronExpression: string;
}

export class RequestAutoCompleteSettingsOptionsDto {
  @ApiProperty({ type: [CronPresetDto] })
  cronPresets: CronPresetDto[];

  @ApiProperty({ enum: AutoCompleteDurationUnit, isArray: true })
  durationUnits: AutoCompleteDurationUnit[];
}
