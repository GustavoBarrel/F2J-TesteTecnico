import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { FindAllQueryDto } from '../common/dto/find-all-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Admin: Usuários')
@ApiBearerAuth()
@UseGuards(GlobalAdminGuard)
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@ApiForbiddenResponse({
  description: 'Acesso permitido apenas para super admin',
})
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Criar usuário' })
  @ApiCreatedResponse({ type: UserResponseDto })
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar usuários',
    description: 'Retorna lista paginada de usuários com filtros opcionais.',
  })
  @ApiPaginatedResponse(UserResponseDto)
  findAll(
    @Query() query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar usuário' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/toggle-active')
  @ApiOperation({
    summary: 'Ativar/desativar usuário',
    description:
      'Ativa/desativa o usuário.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  toggleActive(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.toggleActive(id);
  }
}
