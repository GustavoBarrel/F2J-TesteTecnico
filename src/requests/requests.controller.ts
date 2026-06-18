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
} from '@nestjs/swagger';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { ApiCreatedResponse } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Alterar status de uma solicitação' })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para alterar o status' })
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
  @ApiOperation({ summary: 'Atribuir/substituir assignees de uma solicitação' })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para atribuir' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignRequestDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.assign(id, req.user.sub, req.user.isGlobalAdmin, dto);
  }

  @Patch(':id/observers')
  @ApiOperation({ summary: 'Definir observadores de uma solicitação' })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para alterar observadores' })
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
  cancel(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.cancel(id, req.user.sub, req.user.isGlobalAdmin);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Arquivar uma solicitação (apenas concluídas)' })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para arquivar' })
  archive(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<RequestResponseDto> {
    return this.requestsService.archive(id, req.user.sub, req.user.isGlobalAdmin);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Listar mensagens de uma solicitação' })
  @ApiOkResponse({ description: 'Lista de mensagens' })
  @ApiForbiddenResponse({ description: 'Sem permissão para visualizar' })
  findMessages(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.requestsService.findMessages(id, req.user.sub, req.user.isGlobalAdmin);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Enviar mensagem em uma solicitação' })
  @ApiCreatedResponse({ description: 'Mensagem enviada' })
  @ApiForbiddenResponse({ description: 'Sem permissão para enviar mensagem' })
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
  @ApiOperation({ summary: 'Histórico de uma solicitação (apenas admin)' })
  @ApiOkResponse({ description: 'Lista de eventos do histórico' })
  @ApiForbiddenResponse({ description: 'Acesso permitido apenas para super admin' })
  findHistory(@Param('id') id: string) {
    return this.requestsService.findHistory(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar título, descrição ou prioridade de uma solicitação' })
  @ApiOkResponse({ type: RequestResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para editar' })
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
