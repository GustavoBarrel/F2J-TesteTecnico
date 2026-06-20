import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Request,
  Query,
} from '@nestjs/common';
import { RequestsService } from '../services/requests.service';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateRequestDto } from '../dto/update-request.dto';
import { FindAllRequestsQueryDto } from '../dto/find-all-requests-query.dto';
import {
  RequestDetailResponseDto,
  RequestMessageResponseDto,
  RequestResponseDto,
} from '../dto/request-response.dto';
import { Request as ExpressRequest } from 'express';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { CreateRequestMessageDto } from '../dto/create-request-message.dto';
import { ChangeRequestStatusDto } from '../dto/change-request-status.dto';
import { AssignRequestDto, SetObserversDto } from '../dto/assign-request.dto';
import { ReviewRequestSolutionDto } from '../dto/review-request-solution.dto';
import { UsersService } from 'src/users/users.service';
import { UserOptionDto } from 'src/users/dto/user-option.dto';
import { ApiQuery } from '@nestjs/swagger';

type AuthenticatedRequest = ExpressRequest & {
  user: { sub: string; isGlobalAdmin: boolean };
};

@ApiTags('Solicitações')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar solicitação',
    description:
      'Opcionalmente informe `observerIds` para incluir observadores na abertura.',
  })
  @ApiCreatedResponse({ type: RequestResponseDto })
  @ApiNotFoundResponse({ description: 'Serviço ou setor não encontrado' })
  create(
    @Body() createRequestDto: CreateRequestDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.create(
      createRequestDto,
      req.user.sub,
      req.user.isGlobalAdmin,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Listar solicitações',
    description:
      'Lista paginada conforme escopo do usuário autenticado. **Admin global:** todas. **Demais:** solicitações criadas, observadas, do setor (manager), atribuídas (technician) ou fila sem responsável (technician em setor aberto). Filtros: `page`, `limit`, `sectorId`, `status`.',
  })
  @ApiPaginatedResponse(RequestResponseDto)
  findAll(
    @Query() query: FindAllRequestsQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    return this.requestsService.findAll(
      req.user.sub,
      req.user.isGlobalAdmin,
      query,
    );
  }

  @Get('observer-options')
  @ApiOperation({
    summary: 'Listar usuários para seleção de observador',
    description:
      'Retorna usuários ativos do sistema. Observadores podem ser qualquer usuário, não apenas membros do setor.',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiOkResponse({ type: [UserOptionDto] })
  findObserverOptions(@Query('search') search?: string) {
    return this.usersService.findObserverOptions(search);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar detalhes de uma solicitação',
    description:
      'Retorna dados principais + `permissions`. **Não inclui** mensagens nem histórico — use `GET /requests/:id/messages` (paginado) e `GET /admin/requests/:id/history` (somente admin global).',
  })
  @ApiOkResponse({ type: RequestDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiForbiddenResponse({ description: 'Sem permissão para visualizar' })
  findOne(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestDetailResponseDto> {
    return this.requestsService.findOne(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
    );
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Alterar status de uma solicitação',
    description:
      'Body aceita apenas `PENDING`, `IN_PROGRESS` ou `SOLVED` — `COMPLETED` não é valor válido aqui (use `PATCH /:id/solution-review`). `SOLVED` encaminha ao requerente revisar a solução. Cancelar: `PATCH /:id/cancel`. Admin global pode alterar status mesmo em chamados bloqueados (ex.: `COMPLETED` → `PENDING` para reabrir). Demais papéis só alteram enquanto o chamado não estiver bloqueado.',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para alterar o status' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({
    description:
      'Transição de status inválida ou solicitação cancelada/arquivada',
  })
  changeStatus(
    @Param('id') id: string,
    @Body() body: ChangeRequestStatusDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.changeStatus(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
      body.status,
    );
  }

  @Patch(':id/solution-review')
  @ApiOperation({
    summary: 'Aprovar ou rejeitar solução do chamado',
    description:
      'Disponível quando o status é `SOLVED`. O requerente (criador) ou admin global pode aprovar (`approved: true` → `COMPLETED`) ou rejeitar (`approved: false` → `IN_PROGRESS`).',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para revisar a solução' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({
    description: 'Solicitação não está com status SOLVED',
  })
  reviewSolution(
    @Param('id') id: string,
    @Body() body: ReviewRequestSolutionDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.reviewSolution(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
      body.approved,
    );
  }

  @Patch(':id/assign')
  @ApiOperation({
    summary: 'Atribuir responsáveis a uma solicitação',
    description:
      'Substitui toda a lista atual de responsáveis. Envie `userIds: []` para remover todos. Os usuários devem ser membros do setor.',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para atribuir' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({
    description:
      'Um ou mais usuários não são membros do setor, ou solicitação cancelada/arquivada',
  })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignRequestDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.assign(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
      dto,
    );
  }

  @Patch(':id/observers')
  @ApiOperation({
    summary: 'Definir observadores de uma solicitação',
    description:
      'Substitui toda a lista atual. Permitido para criador, gerente, admin, ou técnico responsável quando o setor permite edição por técnico (onlyManagerCanEdit=false). Envie `userIds: []` para remover todos.',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({
    description: 'Sem permissão para alterar observadores',
  })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({ description: 'Solicitação cancelada ou arquivada' })
  setObservers(
    @Param('id') id: string,
    @Body() dto: SetObserversDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.setObservers(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
      dto,
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar uma solicitação' })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para cancelar' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({
    description: 'Solicitação já cancelada ou arquivada',
  })
  cancel(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.cancel(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
    );
  }

  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Arquivar uma solicitação',
    description:
      'Apenas solicitações com status `COMPLETED` podem ser arquivadas.',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para arquivar' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({
    description: 'Solicitação não está concluída ou já está arquivada',
  })
  archive(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.archive(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
    );
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Listar mensagens de uma solicitação',
    description:
      'Retorna as mensagens do chamado de forma paginada para suportar carregamento incremental no front-end.',
  })
  @ApiPaginatedResponse(RequestMessageResponseDto)
  @ApiForbiddenResponse({ description: 'Sem permissão para visualizar' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  findMessages(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PaginatedResponseDto<RequestMessageResponseDto>> {
    return this.requestsService.findMessages(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
      query,
    );
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Enviar mensagem em uma solicitação' })
  @ApiCreatedResponse({ type: RequestMessageResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para enviar mensagem' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  sendMessage(
    @Param('id') id: string,
    @Body() body: CreateRequestMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.requestsService.sendMessage(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
      body.content,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar título, descrição ou prioridade de uma solicitação',
    description:
      'Status não é alterado aqui — use `PATCH /requests/:id/status`.',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para editar' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({ description: 'Solicitação cancelada ou arquivada' })
  update(
    @Param('id') id: string,
    @Body() updateRequestDto: UpdateRequestDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.update(
      id,
      req.user.sub,
      req.user.isGlobalAdmin,
      updateRequestDto,
    );
  }
}
