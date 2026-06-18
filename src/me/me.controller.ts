import { Controller, Get, Query, Request } from '@nestjs/common';
import { MeService } from './me.service';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';
import { MeSectorResponseDto } from './dto/me-sector-response.dto';
import { FindAllRequestsQueryDto } from 'src/requests/dto/find-all-requests-query.dto';
import { RequestResponseDto } from 'src/requests/dto/request-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';

type AuthenticatedRequest = ExpressRequest & {
  user: { sub: string; isGlobalAdmin: boolean };
};

@ApiTags('Me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('sectors')
  @ApiOperation({ summary: 'Setores do usuário com contagem por status' })
  @ApiOkResponse({ type: MeSectorResponseDto, isArray: true })
  getMySectors(
    @Query() query: FindAllQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<MeSectorResponseDto[]> {
    return this.meService.getMySectors(
      req.user.sub,
      req.user.isGlobalAdmin,
      query,
    );
  }

  @Get('requests/assigned')
  @ApiOperation({ summary: 'Solicitações atribuídas ao usuário' })
  @ApiPaginatedResponse(RequestResponseDto)
  findAssigned(
    @Query() query: FindAllRequestsQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    return this.meService.findAssignedRequests(
      req.user.sub,
      req.user.isGlobalAdmin,
      query,
    );
  }

  @Get('requests')
  @ApiOperation({ summary: 'Solicitações criadas pelo usuário' })
  @ApiPaginatedResponse(RequestResponseDto)
  findMyRequests(
    @Query() query: FindAllRequestsQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    console.log('123123123');
    return this.meService.findMyRequests(
      req.user.sub,
      req.user.isGlobalAdmin,
      query,
    );
  }
}
