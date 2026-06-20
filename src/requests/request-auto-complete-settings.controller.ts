import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import { RequestAutoCompleteSettingsService } from './request-auto-complete-settings.service';
import { RequestAutoCompleteSettingsResponseDto } from './dto/request-auto-complete-settings-response.dto';
import { UpdateRequestAutoCompleteSettingsDto } from './dto/update-request-auto-complete-settings.dto';
import { RequestAutoCompleteSettingsOptionsDto } from './dto/request-auto-complete-settings-options.dto';
import { RequestsAutoCompleteJob } from './requests-auto-complete.job';

type AuthenticatedRequest = {
  user: { sub: string; isGlobalAdmin: boolean };
};

@ApiTags('Admin: Configurações')
@ApiBearerAuth()
@UseGuards(GlobalAdminGuard)
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@ApiForbiddenResponse({ description: 'Acesso permitido apenas para super admin' })
@Controller('admin/settings/request-auto-complete')
export class RequestAutoCompleteSettingsController {
  constructor(
    private readonly settingsService: RequestAutoCompleteSettingsService,
    private readonly autoCompleteJob: RequestsAutoCompleteJob,
  ) {}

  @Get('options')
  @ApiOperation({ summary: 'Opções disponíveis para configurar auto-conclusão' })
  @ApiOkResponse({ type: RequestAutoCompleteSettingsOptionsDto })
  getOptions(): RequestAutoCompleteSettingsOptionsDto {
    return this.settingsService.getOptions();
  }

  @Get()
  @ApiOperation({ summary: 'Obter configuração de auto-conclusão de SOLVED' })
  @ApiOkResponse({ type: RequestAutoCompleteSettingsResponseDto })
  getSettings(): Promise<RequestAutoCompleteSettingsResponseDto> {
    return this.settingsService.getSettings();
  }

  @Patch()
  @ApiOperation({
    summary: 'Atualizar configuração de auto-conclusão de SOLVED',
    description:
      'Atualiza cron e prazo. O job é reagendado imediatamente após salvar.',
  })
  @ApiOkResponse({ type: RequestAutoCompleteSettingsResponseDto })
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateRequestAutoCompleteSettingsDto,
  ): Promise<RequestAutoCompleteSettingsResponseDto> {
    const updated = await this.settingsService.updateSettings(dto, req.user.sub);

    if (dto.cronExpression !== undefined) {
      await this.autoCompleteJob.refreshSchedule(updated.cronExpression);
    }

    return updated;
  }
}
