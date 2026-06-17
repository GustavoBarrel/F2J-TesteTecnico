import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import { RoleOptionResponseDto } from './dto/role-response.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cargos' })
  @UseGuards(GlobalAdminGuard)
  @ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
  @ApiForbiddenResponse({ description: 'Acesso permitido apenas para super admin' })
  findOptions(): Promise<RoleOptionResponseDto[]> {
    return this.rolesService.findOptions();
  }

  @Get(':id')
  @UseGuards(GlobalAdminGuard)
  @ApiOkResponse({ type: RoleOptionResponseDto })
  @ApiNotFoundResponse({ description: 'Cargo não encontrado' })
  findOne(@Param('id') id: string): Promise<RoleOptionResponseDto> {
    return this.rolesService.findOne(id);
  }
}
