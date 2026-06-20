import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
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
import { RoleOptionResponseDto } from './dto/role-response.dto';

@ApiTags('Admin: Cargos')
@ApiBearerAuth()
@UseGuards(GlobalAdminGuard)
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@ApiForbiddenResponse({
  description: 'Acesso permitido apenas para super admin',
})
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cargos' })
  findOptions(): Promise<RoleOptionResponseDto[]> {
    return this.rolesService.findOptions();
  }

  @Get(':id')
  @ApiOkResponse({ type: RoleOptionResponseDto })
  @ApiNotFoundResponse({ description: 'Cargo não encontrado' })
  findOne(@Param('id') id: string): Promise<RoleOptionResponseDto> {
    return this.rolesService.findOne(id);
  }
}
