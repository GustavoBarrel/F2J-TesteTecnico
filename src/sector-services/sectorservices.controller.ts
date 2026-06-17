import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { SectorservicesService } from './sectorservices.service';
import { CreateSectorserviceDto } from './dto/create-sectorservice.dto';
import { UpdateSectorserviceDto } from './dto/update-sectorservice.dto';
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import { ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';
import { SectorServiceResponseDto } from './dto/sectorservice-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@ApiTags('Admin: Serviços do Setor')
@ApiBearerAuth()
@UseGuards(GlobalAdminGuard)
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@ApiForbiddenResponse({
  description: 'Acesso permitido apenas para super admin',
})
@Controller('sectors/:sectorId/services')
export class SectorservicesController {
  constructor(private readonly sectorservicesService: SectorservicesService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Serviço do Setor criado com sucesso' })
  @ApiOperation({ summary: 'Criar um novo serviço do setor' })
  create(@Param('sectorId') sectorId: string, @Body() createSectorserviceDto: CreateSectorserviceDto) {
    return this.sectorservicesService.create(sectorId,createSectorserviceDto);
  }

  @Get()
  @ApiOkResponse({ description: 'Lista paginada de serviços do setor' })
  @ApiOperation({ summary: 'Listar serviços de um setor' })
  findAll(@Param('sectorId') sectorId: string, @Query() query: FindAllQueryDto) : Promise<PaginatedResponseDto<SectorServiceResponseDto>> {
    return this.sectorservicesService.findAll(sectorId, query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Serviço do Setor encontrado com sucesso' })
  @ApiOperation({ summary: 'Buscar um serviço do setor' })
  findOne(@Param('id') id: string, @Param('sectorId') sectorId: string) : Promise<SectorServiceResponseDto> {
    return this.sectorservicesService.findOne(id, sectorId);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Serviço do Setor atualizado com sucesso' })
  @ApiOperation({ summary: 'Atualizar um serviço do setor' })
  update(@Param('id') id: string, @Param('sectorId') sectorId: string, @Body() updateSectorserviceDto: UpdateSectorserviceDto) : Promise<SectorServiceResponseDto> {
    return this.sectorservicesService.update(id, sectorId, updateSectorserviceDto);
  }

  @Patch(':id/toggle-active')
  @ApiOkResponse({ description: 'Serviço do Setor ativado/desativado com sucesso' })
  @ApiOperation({ summary: 'Ativar/desativar um serviço do setor' })
  toggleActive(@Param('id') id: string, @Param('sectorId') sectorId: string) : Promise<SectorServiceResponseDto> {
    return this.sectorservicesService.toggleActive(id, sectorId);
  }
}
