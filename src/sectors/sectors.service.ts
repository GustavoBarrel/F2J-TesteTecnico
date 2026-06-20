import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectorResponseDto } from './dto/sector-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
} from 'src/common/dto/pagination-query.dto';
import { Prisma } from '../../generated/prisma/client';
import { UserResponseDto } from 'src/users/dto/user-response.dto';
import { FindServiceOptionsResponseDto } from './dto/find-service-options-response.dto';

@Injectable()
export class SectorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSectorDto: CreateSectorDto): Promise<SectorResponseDto> {
    const sector = await this.prisma.sector.create({
      data: createSectorDto,
    });
    return sector;
  }

  async findAll(
    query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<SectorResponseDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.SectorWhereInput = {
      isActive: query.isActive ?? undefined,
      OR: query.search
        ? [{ name: { contains: query.search, mode: 'insensitive' } }]
        : undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.sector.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.sector.count({
        where,
      }),
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

  async findOne(id: string): Promise<SectorResponseDto> {
    const sector = await this.prisma.sector.findUnique({
      where: { id },
      include: {
        sectorServices: true,
      },
    });

    if (!sector) {
      throw new NotFoundException('Setor não encontrado');
    }

    return sector;
  }

  async update(
    id: string,
    updateSectorDto: UpdateSectorDto,
  ): Promise<SectorResponseDto> {
    await this.findOne(id);

    const updatedSector = await this.prisma.sector.update({
      where: { id },
      data: updateSectorDto,
    });

    return updatedSector;
  }

  async findAvailableUsers(
    id: string,
    query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    await this.findOne(id);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const memberships = await this.prisma.userSectorMembership.findMany({
      where: { sectorId: id },
      select: { userId: true },
    });

    const memberUserIds = memberships.map((m) => m.userId);

    const where: Prisma.UserWhereInput = {
      isActive: true,
      id: { notIn: memberUserIds },
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
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          username: true,
          isGlobalAdmin: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { firstName: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async toggleActive(id: string): Promise<SectorResponseDto> {
    const sector = await this.findOne(id);

    const updatedSector = await this.prisma.sector.update({
      where: { id },
      data: { isActive: !sector.isActive },
    });

    return updatedSector;
  }

  async findAssigneeOptions(
    sectorId: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: { id: string; name: string; slug: string };
    }>
  > {
    await this.findOne(sectorId);

    if (!isGlobalAdmin) {
      const membership = await this.prisma.userSectorMembership.findFirst({
        where: { sectorId, userId },
      });
      if (!membership) {
        throw new ForbiddenException('Sem acesso a este setor');
      }
    }

    const memberships = await this.prisma.userSectorMembership.findMany({
      where: { sectorId, user: { isActive: true } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        role: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ role: { slug: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    return memberships.map(({ user, role }) => ({ ...user, role }));
  }

  async findSectorServicesOptions(): Promise<FindServiceOptionsResponseDto[]> {
    const sectorServices = await this.prisma.sector.findMany({
      where: { isActive: true },
      include: {
        sectorServices: {
          where: { isActive: true },
        },
      },
    });

    return sectorServices;
  }
}
