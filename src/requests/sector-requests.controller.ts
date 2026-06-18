import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { RequestsService } from './requests.service';
import { FindSectorRequestsQueryDto } from './dto/find-all-requests-query.dto';
import { RequestResponseDto } from './dto/request-response.dto';
import { SectorsService } from 'src/sectors/sectors.service';
import { SectorMemberOptionDto } from 'src/sectors/dto/sector-member-option.dto';

type AuthenticatedRequest = ExpressRequest & {
  user: { sub: string; isGlobalAdmin: boolean };
};

@ApiTags('Solicitações por Setor')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@Controller('sectors/:sectorId')
export class SectorRequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly sectorsService: SectorsService,
  ) {}

  @Get('requests')
  @ApiOperation({
    summary: 'Listar solicitações de um setor',
    description:
      'Retorna as solicitações do setor respeitando as regras de visibilidade.\n\n' +
      '- **Admin / Manager**: vê todas do setor.\n' +
      '- **Technician** com `onlyManagerCanView=false`: vê todas sem atribuído, as atribuídas a ele, as que criou e as que observa.\n' +
      '- **Technician** com `onlyManagerCanView=true`: vê apenas as atribuídas a ele, as que criou e as que observa.\n\n' +
      'Use `scope=queue` para filtrar apenas solicitações sem responsável atribuído.',
  })
  @ApiPaginatedResponse(RequestResponseDto)
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  findBySector(
    @Param('sectorId') sectorId: string,
    @Query() query: FindSectorRequestsQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    return this.requestsService.findBySector(
      sectorId,
      req.user.sub,
      req.user.isGlobalAdmin,
      query,
    );
  }

  @Get('members/options')
  @ApiOperation({
    summary: 'Listar membros do setor para seleção de assignee/observer',
    description: 'Retorna apenas membros ativos. Use para popular o select de atribuição.',
  })
  @ApiOkResponse({ type: [SectorMemberOptionDto] })
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  findMembersOptions(@Param('sectorId') sectorId: string) {
    return this.sectorsService.findMembersOptions(sectorId);
  }
}
