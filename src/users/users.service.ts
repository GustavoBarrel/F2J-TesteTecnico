import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { FindAllQueryDto } from '../common/dto/find-all-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from 'src/common/dto/pagination-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';

const SALT_ROUNDS = 10;

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  username: true,
  isGlobalAdmin: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const password = await bcrypt.hash(createUserDto.password, SALT_ROUNDS);

    const username =
      createUserDto.username ??
      `${createUserDto.firstName.toLowerCase()}.${createUserDto.lastName.toLowerCase()}`;

    return this.prisma.user.create({
      data: {
        ...createUserDto,
        username,
        password,
      },
      select: userSelect,
    });
  }

  async findAll(
    query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {
      isActive: query.isActive ?? undefined,
      OR: query.search
        ? [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { username: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: userSelect,
      }),
      this.prisma.user.count({ where }),
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

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const current = await this.findOne(id);

    const password = updateUserDto.password
      ? await bcrypt.hash(updateUserDto.password, SALT_ROUNDS)
      : undefined;

    const firstName = updateUserDto.firstName ?? current.firstName;
    const lastName = updateUserDto.lastName ?? current.lastName;
    const username =
      updateUserDto.username ??
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;

    return this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        username,
        ...(password ? { password } : {}),
      },
      select: userSelect,
    });
  }

  async toggleActive(id: string): Promise<UserResponseDto> {
    const user = await this.findOne(id);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: !user.isActive,
      },
      select: userSelect,
    });

    return updatedUser;
  }
}
