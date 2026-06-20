import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SectorservicesService } from './sector-services.service';
import { CreateSectorserviceDto } from './dto/create-sector-service.dto';
import { UpdateSectorserviceDto } from './dto/update-sector-service.dto';
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';
import { SectorServiceResponseDto } from './dto/sector-service-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';

@ApiTags('Admin: Serviços do Setor')
@ApiBearerAuth()
@UseGuards(GlobalAdminGuard)
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@ApiForbiddenResponse({
  description: 'Acesso permitido apenas para super admin',
})
@Controller('admin/sectors/:sectorId/services')
export class SectorservicesController {
  constructor(private readonly sectorservicesService: SectorservicesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar um novo serviço do setor' })
  @ApiCreatedResponse({ type: SectorServiceResponseDto })
  create(
    @Param('sectorId') sectorId: string,
    @Body() createSectorserviceDto: CreateSectorserviceDto,
  ): Promise<SectorServiceResponseDto> {
    return this.sectorservicesService.create(sectorId, createSectorserviceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar serviços de um setor' })
  @ApiPaginatedResponse(SectorServiceResponseDto)
  @ApiOkResponse({ type: SectorServiceResponseDto })
  findAll(
    @Param('sectorId') sectorId: string,
    @Query() query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<SectorServiceResponseDto>> {
    return this.sectorservicesService.findAll(sectorId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar um serviço do setor' })
  @ApiOkResponse({ type: SectorServiceResponseDto })
  findOne(
    @Param('id') id: string,
    @Param('sectorId') sectorId: string,
  ): Promise<SectorServiceResponseDto> {
    return this.sectorservicesService.findOne(id, sectorId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar um serviço do setor' })
  @ApiOkResponse({ type: SectorServiceResponseDto })
  update(
    @Param('id') id: string,
    @Param('sectorId') sectorId: string,
    @Body() updateSectorserviceDto: UpdateSectorserviceDto,
  ): Promise<SectorServiceResponseDto> {
    return this.sectorservicesService.update(
      id,
      sectorId,
      updateSectorserviceDto,
    );
  }

  @Patch(':id/toggle-active')
  @ApiOperation({ summary: 'Ativar/desativar um serviço do setor' })
  @ApiOkResponse({ type: SectorServiceResponseDto })
  toggleActive(
    @Param('id') id: string,
    @Param('sectorId') sectorId: string,
  ): Promise<SectorServiceResponseDto> {
    return this.sectorservicesService.toggleActive(id, sectorId);
  }
}
