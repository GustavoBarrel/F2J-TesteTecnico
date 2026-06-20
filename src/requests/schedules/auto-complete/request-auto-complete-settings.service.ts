import { BadRequestException, Injectable } from '@nestjs/common';
import { CronJob } from 'cron';
import {
  AutoCompleteDurationUnit,
  RequestAutoCompleteSetting,
} from '../../../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateRequestAutoCompleteSettingsDto } from './dto/update-request-auto-complete-settings.dto';
import { RequestAutoCompleteSettingsResponseDto } from './dto/request-auto-complete-settings-response.dto';
import { RequestAutoCompleteSettingsOptionsDto } from './dto/request-auto-complete-settings-options.dto';

const SETTINGS_ID = 'default';

const CRON_PRESETS = [
  { label: 'A cada 10 minutos', cronExpression: '*/10 * * * *' },
  { label: 'A cada hora', cronExpression: '0 * * * *' },
  { label: 'Todo dia às 6h', cronExpression: '0 6 * * *' },
  { label: 'Todo dia às 3h', cronExpression: '0 3 * * *' },
] as const;

@Injectable()
export class RequestAutoCompleteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getOptions(): RequestAutoCompleteSettingsOptionsDto {
    return {
      cronPresets: [...CRON_PRESETS],
      durationUnits: [
        AutoCompleteDurationUnit.MINUTES,
        AutoCompleteDurationUnit.DAYS,
      ],
    };
  }

  async getSettings(): Promise<RequestAutoCompleteSettingsResponseDto> {
    const settings = await this.ensureSettings();
    return this.toResponseDto(settings);
  }

  async getCronExpression(): Promise<string> {
    const settings = await this.ensureSettings();
    return settings.cronExpression;
  }

  async getDuration(): Promise<{
    cutoff: Date;
    value: number;
    unit: 'minutes' | 'days';
  }> {
    const settings = await this.ensureSettings();
    const cutoff = new Date();

    if (settings.durationUnit === AutoCompleteDurationUnit.MINUTES) {
      cutoff.setMinutes(cutoff.getMinutes() - settings.durationValue);
      return { cutoff, value: settings.durationValue, unit: 'minutes' };
    }

    cutoff.setDate(cutoff.getDate() - settings.durationValue);
    return { cutoff, value: settings.durationValue, unit: 'days' };
  }

  async updateSettings(
    dto: UpdateRequestAutoCompleteSettingsDto,
    updatedById: string,
  ): Promise<RequestAutoCompleteSettingsResponseDto> {
    if (
      dto.cronExpression === undefined &&
      dto.durationValue === undefined &&
      dto.durationUnit === undefined
    ) {
      throw new BadRequestException('Informe ao menos um campo para atualizar');
    }

    if (dto.cronExpression !== undefined) {
      this.assertValidCronExpression(dto.cronExpression);
    }

    const nextUnit =
      dto.durationUnit ?? (await this.ensureSettings()).durationUnit;
    const nextValue =
      dto.durationValue ?? (await this.ensureSettings()).durationValue;

    if (dto.durationValue !== undefined || dto.durationUnit !== undefined) {
      this.assertValidDuration(nextValue, nextUnit);
    }

    const updated = await this.prisma.requestAutoCompleteSetting.update({
      where: { id: SETTINGS_ID },
      data: {
        ...(dto.cronExpression !== undefined
          ? { cronExpression: this.normalizeCronExpression(dto.cronExpression) }
          : {}),
        ...(dto.durationValue !== undefined
          ? { durationValue: dto.durationValue }
          : {}),
        ...(dto.durationUnit !== undefined
          ? { durationUnit: dto.durationUnit }
          : {}),
        updatedById,
      },
    });

    return this.toResponseDto(updated);
  }

  normalizeCronExpression(expression: string): string {
    return expression
      .replace(/["']/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join(' ');
  }

  assertValidCronExpression(expression: string): void {
    const normalized = this.normalizeCronExpression(expression);

    if (normalized.split(/\s+/).length !== 5) {
      throw new BadRequestException(
        'cronExpression inválida. Use 5 campos: minuto hora dia mês dia-da-semana',
      );
    }

    try {
      CronJob.from({ cronTime: normalized, onTick: () => undefined });
    } catch {
      throw new BadRequestException('cronExpression inválida');
    }
  }

  private assertValidDuration(
    value: number,
    unit: AutoCompleteDurationUnit,
  ): void {
    if (unit === AutoCompleteDurationUnit.MINUTES && value > 1440) {
      throw new BadRequestException(
        'durationValue em minutos não pode exceder 1440',
      );
    }

    if (unit === AutoCompleteDurationUnit.DAYS && value > 365) {
      throw new BadRequestException(
        'durationValue em dias não pode exceder 365',
      );
    }
  }

  private async ensureSettings(): Promise<RequestAutoCompleteSetting> {
    return this.prisma.requestAutoCompleteSetting.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: {
        id: SETTINGS_ID,
        cronExpression: '0 6 * * *',
        durationValue: 1,
        durationUnit: AutoCompleteDurationUnit.DAYS,
      },
    });
  }

  private toResponseDto(
    settings: RequestAutoCompleteSetting,
  ): RequestAutoCompleteSettingsResponseDto {
    return {
      cronExpression: settings.cronExpression,
      durationValue: settings.durationValue,
      durationUnit: settings.durationUnit,
      updatedAt: settings.updatedAt,
    };
  }
}
