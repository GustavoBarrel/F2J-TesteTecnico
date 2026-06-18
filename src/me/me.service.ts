import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestsService } from 'src/requests/requests.service';
import { RequestResponseDto } from 'src/requests/dto/request-response.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';
import { FindAllRequestsQueryDto } from 'src/requests/dto/find-all-requests-query.dto';
import { MeSectorResponseDto } from './dto/me-sector-response.dto';
import {
  Prisma,
  Role,
  RoleSlug,
  Sector,
  UserSectorMembership,
} from '../../generated/prisma/client';

type MembershipWithSector = UserSectorMembership & {
  role: Role;
  sector: Sector;
};

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestsService: RequestsService,
  ) {}

  async getMySectors(
    userId: string,
    isGlobalAdmin: boolean,
    query: FindAllQueryDto,
  ): Promise<MeSectorResponseDto[]> {
    if (isGlobalAdmin) {
      const sectors = await this.prisma.sector.findMany({
        where: this.buildSectorFilter(query),
        orderBy: { name: 'asc' },
      });

      return Promise.all(
        sectors.map((sector) =>
          this.buildSectorSummary(sector, null, userId, isGlobalAdmin, []),
        ),
      );
    }

    const memberships = await this.prisma.userSectorMembership.findMany({
      where: { userId },
      include: { role: true, sector: true },
    });

    const filtered = memberships.filter((membership) =>
      this.matchesSectorFilter(membership.sector, query),
    );

    return Promise.all(
      filtered.map((membership) =>
        this.buildSectorSummary(
          membership.sector,
          membership.role.slug,
          userId,
          isGlobalAdmin,
          memberships,
        ),
      ),
    );
  }

  findMyRequests(
    userId: string,
    isGlobalAdmin: boolean,
    query: FindAllRequestsQueryDto,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    return this.requestsService.findMine(userId, isGlobalAdmin, query);
  }

  findAssignedRequests(
    userId: string,
    isGlobalAdmin: boolean,
    query: FindAllRequestsQueryDto,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    return this.requestsService.findAssigned(userId, isGlobalAdmin, query);
  }

  private buildSectorFilter(query: FindAllQueryDto): Prisma.SectorWhereInput {
    return {
      isActive: query.isActive ?? true,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
  }

  private matchesSectorFilter(sector: Sector, query: FindAllQueryDto): boolean {
    const isActive = query.isActive ?? true;
    if (sector.isActive !== isActive) {
      return false;
    }

    if (
      query.search &&
      !sector.name.toLowerCase().includes(query.search.toLowerCase())
    ) {
      return false;
    }

    return true;
  }

  private buildSectorVisibilityWhere(
    sectorId: string,
    userId: string,
    isGlobalAdmin: boolean,
    memberships: MembershipWithSector[],
  ): Prisma.RequestWhereInput {
    if (isGlobalAdmin) {
      return { sectorId };
    }

    const membership = memberships.find((m) => m.sectorId === sectorId);
    if (!membership) {
      return { id: { in: [] } };
    }

    if (membership.role.slug === RoleSlug.MANAGER) {
      return { sectorId };
    }

    if (!membership.sector.onlyManagerCanView) {
      return {
        OR: [
          { sectorId, assignees: { none: {} } },
          { sectorId, assignees: { some: { userId } } },
          { sectorId, createdById: userId },
          { sectorId, observers: { some: { userId } } },
        ],
      };
    }

    return {
      OR: [
        { sectorId, assignees: { some: { userId } } },
        { sectorId, createdById: userId },
        { sectorId, observers: { some: { userId } } },
      ],
    };
  }

  private async buildSectorSummary(
    sector: Sector,
    role: RoleSlug | null,
    userId: string,
    isGlobalAdmin: boolean,
    memberships: MembershipWithSector[],
  ): Promise<MeSectorResponseDto> {
    const where = this.buildSectorVisibilityWhere(
      sector.id,
      userId,
      isGlobalAdmin,
      memberships,
    );

    const groups = await this.prisma.request.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    return {
      id: sector.id,
      name: sector.name,
      role,
      onlyManagerCanView: sector.onlyManagerCanView,
      onlyManagerCanEdit: sector.onlyManagerCanEdit,
      onlyManagerCanArchive: sector.onlyManagerCanArchive,
      statusCounts: groups.map((group) => ({
        status: group.status,
        count: group._count._all,
      })),
    };
  }
}
