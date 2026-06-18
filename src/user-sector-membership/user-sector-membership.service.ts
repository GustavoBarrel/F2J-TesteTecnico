import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserSectorMembershipDto } from './dto/create-user-sector-membership.dto';
import { UpdateUserSectorMembershipDto } from './dto/update-user-sector-membership.dto';
import { UserSectorMembershipResponseDto } from './dto/user-sector-membership-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RolesService } from 'src/roles/roles.service';
import { SectorsService } from 'src/sectors/sectors.service';
import { UsersService } from 'src/users/users.service';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from 'src/common/dto/pagination-query.dto';
import { Prisma } from '../../generated/prisma/client';

const membershipInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      isActive: true,
    },
  },
  role: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.UserSectorMembershipInclude;

@Injectable()
export class UserSectorMembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
    private readonly sectorsService: SectorsService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    sectorId: string,
    createUserSectorMembershipDto: CreateUserSectorMembershipDto,
  ): Promise<UserSectorMembershipResponseDto> {
    await this.sectorsService.findOne(sectorId);
    await this.rolesService.findOne(createUserSectorMembershipDto.roleId);
    await this.usersService.findOne(createUserSectorMembershipDto.userId);

    return this.prisma.userSectorMembership.create({
      data: {
        userId: createUserSectorMembershipDto.userId,
        sectorId,
        roleId: createUserSectorMembershipDto.roleId,
      },
      include: membershipInclude,
    });
  }

  async findAll(
    sectorId: string,
    query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<UserSectorMembershipResponseDto>> {
    await this.sectorsService.findOne(sectorId);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.UserSectorMembershipWhereInput = {
      sectorId,
      user: {
        isActive: query.isActive ?? undefined,
        OR: query.search
          ? [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { username: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.userSectorMembership.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: membershipInclude,
      }),
      this.prisma.userSectorMembership.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    sectorId: string,
  ): Promise<UserSectorMembershipResponseDto> {
    await this.sectorsService.findOne(sectorId);

    const membership = await this.prisma.userSectorMembership.findFirst({
      where: { id, sectorId },
      include: membershipInclude,
    });

    if (!membership) {
      throw new NotFoundException('Membership não encontrada');
    }

    return membership;
  }

  async update(
    id: string,
    sectorId: string,
    updateUserSectorMembershipDto: UpdateUserSectorMembershipDto,
  ): Promise<UserSectorMembershipResponseDto> {
    await this.findOne(id, sectorId);
    await this.rolesService.findOne(updateUserSectorMembershipDto.roleId);

    return this.prisma.userSectorMembership.update({
      where: { id },
      data: { roleId: updateUserSectorMembershipDto.roleId },
      include: membershipInclude,
    });
  }

  async remove(id: string, sectorId: string): Promise<void> {
    await this.findOne(id, sectorId);

    await this.prisma.userSectorMembership.delete({
      where: { id },
    });
  }
}
