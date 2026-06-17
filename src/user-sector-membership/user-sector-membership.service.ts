import { Injectable } from '@nestjs/common';
import { CreateUserSectorMembershipDto } from './dto/create-user-sector-membership.dto';
import { UpdateUserSectorMembershipDto } from './dto/update-user-sector-membership.dto';
import { UserSectorMembershipResponseDto } from './dto/user-sector-membership-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RolesService } from 'src/roles/roles.service';
import { SectorsService } from 'src/sectors/sectors.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class UserSectorMembershipService {
  constructor(private readonly prisma: PrismaService, private readonly rolesService: RolesService, private readonly sectorsService: SectorsService, private readonly usersService: UsersService) {}

  async create(createUserSectorMembershipDto: CreateUserSectorMembershipDto): Promise<UserSectorMembershipResponseDto> {
    await this.rolesService.findOne(createUserSectorMembershipDto.roleId);

    await this.sectorsService.findOne(createUserSectorMembershipDto.sectorId);

    await this.usersService.findOne(createUserSectorMembershipDto.userId);

    return this.prisma.userSectorMembership.create({
      data: {
        userId: createUserSectorMembershipDto.userId,
        sectorId: createUserSectorMembershipDto.sectorId,
        roleId: createUserSectorMembershipDto.roleId,
      },
      select: {
        id: true,
        userId: true,
        sectorId: true,
        roleId: true,
      },
    });
  }

  findAll() {
    return `This action returns all userSectorMembership`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userSectorMembership`;
  }

  update(
    id: number,
    _updateUserSectorMembershipDto: UpdateUserSectorMembershipDto,
  ) {
    return `This action updates a #${id} userSectorMembership`;
  }

  remove(id: number) {
    return `This action removes a #${id} userSectorMembership`;
  }
}
