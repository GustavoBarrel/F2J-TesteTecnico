import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Request,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { FindAllRequestsQueryDto } from './dto/find-all-requests-query.dto';
import {
  RequestDetailResponseDto,
  RequestHistoryEntryDto,
  RequestMessageResponseDto,
  RequestResponseDto,
} from './dto/request-response.dto';
import { Request as ExpressRequest } from 'express';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
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
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import { CreateRequestMessageDto } from './dto/create-request-message.dto';
import { ChangeRequestStatusDto } from './dto/change-request-status.dto';
import { AssignRequestDto, SetObserversDto } from './dto/assign-request.dto';

type AuthenticatedRequest = ExpressRequest & {
  user: { sub: string; isGlobalAdmin: boolean };
};

@ApiTags('Solicitações')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar solicitação' })
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
  @ApiOperation({ summary: 'Listar solicitações' })
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

  @Get(':id')
  @ApiOperation({ summary: 'Buscar detalhes de uma solicitação' })
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
    description: 'Valores permitidos: `PENDING`, `IN_PROGRESS`, `COMPLETED`. Para cancelar use `PATCH /:id/cancel`.',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para alterar o status' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({ description: 'Transição de status inválida ou solicitação cancelada/arquivada' })
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

  @Patch(':id/assign')
  @ApiOperation({
    summary: 'Atribuir responsáveis a uma solicitação',
    description: 'Substitui toda a lista atual de responsáveis. Envie `userIds: []` para remover todos. Os usuários devem ser membros do setor.',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para atribuir' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({ description: 'Um ou mais usuários não são membros do setor, ou solicitação cancelada/arquivada' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignRequestDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.assign(id, req.user.sub, req.user.isGlobalAdmin, dto);
  }

  @Patch(':id/observers')
  @ApiOperation({
    summary: 'Definir observadores de uma solicitação',
    description: 'Substitui toda a lista atual de observadores. Envie `userIds: []` para remover todos.',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para alterar observadores' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({ description: 'Solicitação cancelada ou arquivada' })
  setObservers(
    @Param('id') id: string,
    @Body() dto: SetObserversDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.setObservers(id, req.user.sub, req.user.isGlobalAdmin, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar uma solicitação' })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para cancelar' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({ description: 'Solicitação já cancelada ou arquivada' })
  cancel(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.cancel(id, req.user.sub, req.user.isGlobalAdmin);
  }

  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Arquivar uma solicitação',
    description: 'Apenas solicitações com status `COMPLETED` podem ser arquivadas.',
  })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para arquivar' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiBadRequestResponse({ description: 'Solicitação não está concluída ou já está arquivada' })
  archive(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.archive(id, req.user.sub, req.user.isGlobalAdmin);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Listar mensagens de uma solicitação' })
  @ApiOkResponse({ type: [RequestMessageResponseDto] })
  @ApiForbiddenResponse({ description: 'Sem permissão para visualizar' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  findMessages(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.requestsService.findMessages(id, req.user.sub, req.user.isGlobalAdmin);
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

  @Get(':id/history')
  @UseGuards(GlobalAdminGuard)
  @ApiOperation({ summary: 'Histórico de uma solicitação', description: 'Acesso restrito ao admin global.' })
  @ApiOkResponse({ type: [RequestHistoryEntryDto] })
  @ApiForbiddenResponse({ description: 'Acesso permitido apenas para admin global' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  findHistory(@Param('id') id: string) {
    return this.requestsService.findHistory(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar título, descrição ou prioridade de uma solicitação' })
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
