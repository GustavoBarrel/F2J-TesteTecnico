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
import { SectorsService } from './sectors.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import {
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { SectorResponseDto } from './dto/sector-response.dto';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { UserResponseDto } from 'src/users/dto/user-response.dto';
import { SectorServiceResponseDto } from 'src/sector-services/dto/sector-service-response.dto';
import { FindServiceOptionsResponseDto } from './dto/find-service-options-response.dto';

@ApiTags('Admin: Setores')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@ApiForbiddenResponse({
  description: 'Acesso permitido apenas para super admin',
})
@Controller('sectors')
export class SectorsController {
  constructor(private readonly sectorsService: SectorsService) {}

  @Post()
  @UseGuards(GlobalAdminGuard)
  @ApiOperation({ summary: 'Criar setor' })
  @ApiCreatedResponse({ type: SectorResponseDto })
  create(@Body() createSectorDto: CreateSectorDto): Promise<SectorResponseDto> {
    return this.sectorsService.create(createSectorDto);
  }

  @Get()
  @UseGuards(GlobalAdminGuard)
  @ApiOperation({ summary: 'Listar setores' })
  @ApiPaginatedResponse(SectorResponseDto)
  findAll(
    @Query() query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<SectorResponseDto>> {
    return this.sectorsService.findAll(query);
  }

  @Get(':id/available-users')
  @UseGuards(GlobalAdminGuard)
  @ApiOperation({ summary: 'Listar usuários disponíveis para vincular ao setor', description: 'Retorna paginado os usuários ativos que ainda não possuem membership neste setor.' })
  @ApiPaginatedResponse(UserResponseDto)
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  findAvailableUsers(
    @Param('id') id: string,
    @Query() query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.sectorsService.findAvailableUsers(id, query);
  }

  @Get(':id')
  @UseGuards(GlobalAdminGuard)
  @ApiOperation({ summary: 'Buscar setor por ID' })
  @ApiOkResponse({ type: SectorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  findOne(@Param('id') id: string): Promise<SectorResponseDto> {
    return this.sectorsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(GlobalAdminGuard)
  @ApiOperation({ summary: 'Atualizar setor' })
  @ApiOkResponse({ type: SectorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  update(
    @Param('id') id: string,
    @Body() updateSectorDto: UpdateSectorDto,
  ): Promise<SectorResponseDto> {
    return this.sectorsService.update(id, updateSectorDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(GlobalAdminGuard)
  @ApiOperation({ summary: 'Ativar/desativar setor' })
  @ApiOkResponse({ type: SectorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  toggleActive(@Param('id') id: string): Promise<SectorResponseDto> {
    return this.sectorsService.toggleActive(id);
  }

  @Get('services/options')
  @ApiOperation({ summary: 'Listar opções de serviços para um setor' })
  @ApiOkResponse({ type: FindServiceOptionsResponseDto })
  findSectorServicesOptions(): Promise<FindServiceOptionsResponseDto[]>{
    return this.sectorsService.findSectorServicesOptions();
  }
}
