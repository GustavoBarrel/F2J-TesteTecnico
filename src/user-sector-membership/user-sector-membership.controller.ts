import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserSectorMembershipService } from './user-sector-membership.service';
import { CreateUserSectorMembershipDto } from './dto/create-user-sector-membership.dto';
import { UpdateUserSectorMembershipDto } from './dto/update-user-sector-membership.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import { UserSectorMembershipResponseDto } from './dto/user-sector-membership-response.dto';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

@ApiTags('Admin: Memberships')
@ApiBearerAuth()
@UseGuards(GlobalAdminGuard)
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@ApiForbiddenResponse({
  description: 'Acesso permitido apenas para super admin',
})
@Controller('admin/sectors/:sectorId/members')
export class UserSectorMembershipController {
  constructor(
    private readonly userSectorMembershipService: UserSectorMembershipService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Vincular usuário ao setor' })
  @ApiCreatedResponse({ type: UserSectorMembershipResponseDto })
  create(
    @Param('sectorId') sectorId: string,
    @Body() createUserSectorMembershipDto: CreateUserSectorMembershipDto,
  ): Promise<UserSectorMembershipResponseDto> {
    return this.userSectorMembershipService.create(
      sectorId,
      createUserSectorMembershipDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar membros do setor' })
  @ApiPaginatedResponse(UserSectorMembershipResponseDto)
  findAll(
    @Param('sectorId') sectorId: string,
    @Query() query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<UserSectorMembershipResponseDto>> {
    return this.userSectorMembershipService.findAll(sectorId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar membership por ID' })
  @ApiOkResponse({ type: UserSectorMembershipResponseDto })
  @ApiNotFoundResponse({ description: 'Membership não encontrada' })
  findOne(
    @Param('id') id: string,
    @Param('sectorId') sectorId: string,
  ): Promise<UserSectorMembershipResponseDto> {
    return this.userSectorMembershipService.findOne(id, sectorId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Alterar cargo do membro no setor' })
  @ApiOkResponse({ type: UserSectorMembershipResponseDto })
  @ApiNotFoundResponse({ description: 'Membership não encontrada' })
  update(
    @Param('id') id: string,
    @Param('sectorId') sectorId: string,
    @Body() updateUserSectorMembershipDto: UpdateUserSectorMembershipDto,
  ): Promise<UserSectorMembershipResponseDto> {
    return this.userSectorMembershipService.update(
      id,
      sectorId,
      updateUserSectorMembershipDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover usuário do setor' })
  @ApiNoContentResponse({ description: 'Membership removida' })
  @ApiNotFoundResponse({ description: 'Membership não encontrada' })
  remove(
    @Param('id') id: string,
    @Param('sectorId') sectorId: string,
  ): Promise<void> {
    return this.userSectorMembershipService.remove(id, sectorId);
  }
}
