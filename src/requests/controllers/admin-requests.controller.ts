import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import { RequestsService } from '../services/requests.service';
import { RequestHistoryEntryDto } from '../dto/request-response.dto';

@ApiTags('Admin: Solicitações')
@ApiBearerAuth()
@UseGuards(GlobalAdminGuard)
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@ApiForbiddenResponse({
  description: 'Acesso permitido apenas para admin global',
})
@Controller('admin/requests')
export class AdminRequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get(':id/history')
  @ApiOperation({
    summary: 'Histórico de uma solicitação',
    description: 'Acesso restrito ao admin global.',
  })
  @ApiOkResponse({ type: [RequestHistoryEntryDto] })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  findHistory(@Param('id') id: string) {
    return this.requestsService.findHistory(id);
  }
}
