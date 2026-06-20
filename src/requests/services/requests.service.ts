import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateRequestDto } from '../dto/update-request.dto';
import {
  RequestDetailResponseDto,
  RequestResponseDto,
} from '../dto/request-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectorsService } from 'src/sectors/sectors.service';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  PaginationQueryDto,
} from 'src/common/dto/pagination-query.dto';
import {
  Prisma,
  RequestPriority,
  RequestStatus,
} from '../../../generated/prisma/client';
import {
  FindAllRequestsQueryDto,
  FindSectorRequestsQueryDto,
} from '../dto/find-all-requests-query.dto';
import { AllowedStatus } from '../dto/change-request-status.dto';
import { AssignRequestDto, SetObserversDto } from '../dto/assign-request.dto';
import { RequestActionsService } from './request-actions.service';
import { RequestHistoryService } from 'src/request-history/request-history.service';
import { RequestMessagesAccessService } from './request-messages-access.service';
import { RequestPermissionsService } from './request-permissions.service';
import { requestUserSelect } from '../constants/requests.constants';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sectorsService: SectorsService,
    private readonly permissionsService: RequestPermissionsService,
    private readonly messagesAccessService: RequestMessagesAccessService,
    private readonly historyService: RequestHistoryService,
    private readonly actionsService: RequestActionsService,
  ) {}

  async create(
    createRequestDto: CreateRequestDto,
    userId: string,
    isGlobalAdmin = false,
  ): Promise<RequestResponseDto> {
    const sectorService = await this.prisma.sectorService.findUnique({
      where: { id: createRequestDto.sectorServiceId },
    });

    if (!sectorService?.isActive) {
      throw new NotFoundException('Serviço do setor não encontrado');
    }

    const sector = await this.sectorsService.findOne(sectorService.sectorId);

    if (!sector.isActive) {
      throw new NotFoundException('Setor não encontrado');
    }

    const observerIds = createRequestDto.observerIds ?? [];
    await this.actionsService.validateActiveUserIds(observerIds);
    const observerUsers =
      await this.historyService.fetchUserSummaries(observerIds);

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          title: createRequestDto.title,
          description: createRequestDto.description,
          status: RequestStatus.NEW,
          sectorId: sector.id,
          sectorServiceId: sectorService.id,
          priority: RequestPriority.MEDIUM,
          createdById: userId,
        },
      });

      if (observerIds.length > 0) {
        await tx.requestObserver.createMany({
          data: observerIds.map((observerId) => ({
            requestId: request.id,
            userId: observerId,
          })),
        });
      }

      await this.historyService.recordCreated(
        tx,
        request.id,
        userId,
        createRequestDto.title,
        sectorService.name,
        observerUsers,
      );

      return request;
    });

    return this.findOne(created.id, userId, isGlobalAdmin);
  }

  async findMine(
    userId: string,
    isGlobalAdmin: boolean,
    query: FindAllRequestsQueryDto,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    return this.listRequests(
      {
        OR: [{ createdById: userId }, { observers: { some: { userId } } }],
      },
      userId,
      isGlobalAdmin,
      query,
    );
  }

  async findAssigned(
    userId: string,
    isGlobalAdmin: boolean,
    query: FindAllRequestsQueryDto,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    return this.listRequests(
      { assignees: { some: { userId } } },
      userId,
      isGlobalAdmin,
      query,
    );
  }

  async findBySector(
    sectorId: string,
    userId: string,
    isGlobalAdmin: boolean,
    query: FindSectorRequestsQueryDto,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    await this.sectorsService.findOne(sectorId);

    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);
    const visibilityWhere = this.permissionsService.buildSectorVisibilityWhere(
      sectorId,
      userId,
      isGlobalAdmin,
      memberships,
    );

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const filters: Prisma.RequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.scope === 'queue' ? { assignees: { none: {} } } : {}),
    };

    const where: Prisma.RequestWhereInput = { AND: [visibilityWhere, filters] };

    const [requests, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      }),
      this.prisma.request.count({ where }),
    ]);

    const data = requests.map((r) =>
      this.permissionsService.toResponseDto(
        r,
        userId,
        isGlobalAdmin,
        memberships,
      ),
    );

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

  async findAll(
    userId: string,
    isGlobalAdmin: boolean,
    query: FindAllRequestsQueryDto,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);

    const visibilityWhere = this.permissionsService.buildListWhere(
      userId,
      isGlobalAdmin,
      memberships,
    );

    return this.listRequests(visibilityWhere, userId, isGlobalAdmin, query);
  }

  async findOne(
    id: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<RequestDetailResponseDto> {
    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);

    const request = await this.prisma.request.findUnique({
      where: { id },
      include: {
        sector: {
          select: {
            id: true,
            name: true,
            onlyManagerCanView: true,
            onlyManagerCanEdit: true,
            onlyManagerCanArchive: true,
          },
        },
        sectorService: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: requestUserSelect,
        },
        assignees: {
          include: {
            user: {
              select: requestUserSelect,
            },
          },
        },
        observers: {
          include: {
            user: {
              select: requestUserSelect,
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    const base = this.permissionsService.toResponseDto(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );

    if (!base.permissions.canView) {
      throw new ForbiddenException('Sem permissão para visualizar solicitação');
    }

    return {
      ...base,
      sector: request.sector,
      sectorService: request.sectorService,
      createdBy: request.createdBy,
      assignees: request.assignees.map((assignee) => assignee.user),
      observers: request.observers.map((observer) => observer.user),
    };
  }

  async changeStatus(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    newStatus: AllowedStatus,
  ): Promise<RequestResponseDto> {
    return this.actionsService.changeStatus(
      requestId,
      userId,
      isGlobalAdmin,
      newStatus,
    );
  }

  async reviewSolution(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    approved: boolean,
  ): Promise<RequestResponseDto> {
    return this.actionsService.reviewSolution(
      requestId,
      userId,
      isGlobalAdmin,
      approved,
    );
  }

  async findMessages(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    query: PaginationQueryDto,
  ): Promise<
    PaginatedResponseDto<{
      id: string;
      content: string;
      createdAt: Date;
      author: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    }>
  > {
    return this.messagesAccessService.findMessages(
      requestId,
      userId,
      isGlobalAdmin,
      query,
    );
  }

  async sendMessage(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    content: string,
  ): Promise<{
    id: string;
    content: string;
    createdAt: Date;
    author: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }> {
    return this.messagesAccessService.sendMessage(
      requestId,
      userId,
      isGlobalAdmin,
      content,
    );
  }

  async findHistory(requestId: string) {
    return this.historyService.findHistory(requestId);
  }

  async update(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    dto: UpdateRequestDto,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);

    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        assignees: { select: { userId: true } },
        observers: { select: { userId: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    this.permissionsService.assertRequestActionsAllowed(request);

    const permissions = this.permissionsService.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );

    if (!permissions.canEdit) {
      throw new ForbiddenException(
        'Sem permissão para editar esta solicitação',
      );
    }

    const historyEntries = this.historyService.buildUpdateHistoryEntries(
      request,
      dto,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.update({
        where: { id: requestId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });

      await this.historyService.appendMany(
        tx,
        requestId,
        userId,
        historyEntries,
      );

      return r;
    });

    return this.permissionsService.toResponseDto(
      updated,
      userId,
      isGlobalAdmin,
      memberships,
    );
  }

  async assign(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    dto: AssignRequestDto,
  ): Promise<RequestResponseDto> {
    return this.actionsService.assign(requestId, userId, isGlobalAdmin, dto);
  }

  async setObservers(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    dto: SetObserversDto,
  ): Promise<RequestResponseDto> {
    return this.actionsService.setObservers(
      requestId,
      userId,
      isGlobalAdmin,
      dto,
    );
  }

  async cancel(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<RequestResponseDto> {
    return this.actionsService.cancel(requestId, userId, isGlobalAdmin);
  }

  async archive(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<RequestResponseDto> {
    return this.actionsService.archive(requestId, userId, isGlobalAdmin);
  }

  private async listRequests(
    baseWhere: Prisma.RequestWhereInput,
    userId: string,
    isGlobalAdmin: boolean,
    query: FindAllRequestsQueryDto,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);

    const where: Prisma.RequestWhereInput = {
      AND: [baseWhere, this.buildFilters(query)],
    };

    const [requests, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignees: {
            include: { user: { select: requestUserSelect } },
          },
          observers: {
            include: { user: { select: requestUserSelect } },
          },
        },
      }),
      this.prisma.request.count({ where }),
    ]);

    const data = requests.map((request) =>
      this.permissionsService.toResponseDto(
        request,
        userId,
        isGlobalAdmin,
        memberships,
      ),
    );

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

  private buildFilters(
    query: FindAllRequestsQueryDto,
  ): Prisma.RequestWhereInput {
    return {
      ...(query.sectorId ? { sectorId: query.sectorId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
  }
}
