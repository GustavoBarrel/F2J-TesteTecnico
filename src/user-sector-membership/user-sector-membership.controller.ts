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
import { UserSectorMembershipService } from './user-sector-membership.service';
import { CreateUserSectorMembershipDto } from './dto/create-user-sector-membership.dto';
import { UpdateUserSectorMembershipDto } from './dto/update-user-sector-membership.dto';
import { ApiCreatedResponse, ApiForbiddenResponse, ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { GlobalAdminGuard } from 'src/auth/guards/global-admin.guard';
import { UserSectorMembershipResponseDto } from './dto/user-sector-membership-response.dto';

@Controller('user-sector-membership')
export class UserSectorMembershipController {
  constructor(
    private readonly userSectorMembershipService: UserSectorMembershipService,
  ) {}

  @Post()
  @UseGuards(GlobalAdminGuard)
  @ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
  @ApiForbiddenResponse({ description: 'Acesso permitido apenas para super admin' })
  @ApiCreatedResponse({ type: UserSectorMembershipResponseDto })
  @ApiOperation({ summary: 'Criar membership de usuário em setor' })
  create(@Body() createUserSectorMembershipDto: CreateUserSectorMembershipDto): Promise<UserSectorMembershipResponseDto> {
    return this.userSectorMembershipService.create(createUserSectorMembershipDto);
  }

  @Get()
  findAll() {
    return this.userSectorMembershipService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userSectorMembershipService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserSectorMembershipDto: UpdateUserSectorMembershipDto,
  ) {
    return this.userSectorMembershipService.update(
      +id,
      updateUserSectorMembershipDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userSectorMembershipService.remove(+id);
  }
}
