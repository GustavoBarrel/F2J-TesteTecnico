import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import {
  RequestDetailResponseDto,
  RequestResponseDto,
} from './dto/request-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectorsService } from 'src/sectors/sectors.service';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from 'src/common/dto/pagination-query.dto';
import {
  Prisma,
  Request,
  RequestPriority,
  RequestStatus,
  RequestHistoryAction,
  Role,
  RoleSlug,
  Sector,
  UserSectorMembership,
} from '../../generated/prisma/client';
import { FindAllRequestsQueryDto, FindSectorRequestsQueryDto } from './dto/find-all-requests-query.dto';
import { AllowedStatus } from './dto/change-request-status.dto';
import { AssignRequestDto, SetObserversDto } from './dto/assign-request.dto';

type MembershipWithSector = UserSectorMembership & {
  role: Role;
  sector: Sector;
};

type RequestUserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type RequestWithAccess = Request & {
  assignees?: Array<{ userId: string; user?: RequestUserSummary }>;
  observers?: Array<{ userId: string; user?: RequestUserSummary }>;
};

const requestUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sectorsService: SectorsService,
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

      await tx.requestHistory.create({
        data: {
          requestId: request.id,
          userId,
          action: RequestHistoryAction.CREATED,
          toStatus: RequestStatus.NEW,
        },
      });

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
      { createdById: userId },
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
      : await this.getMemberships(userId);

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
      this.toResponseDto(request, userId, isGlobalAdmin, memberships),
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
      return {
        sectorId,
        OR: [
          { createdById: userId },
          { observers: { some: { userId } } },
        ],
      };
    }

    if (membership.role.slug === RoleSlug.MANAGER) {
      return { sectorId };
    }

    if (!membership.sector.onlyManagerCanView) {
      return {
        sectorId,
        OR: [
          { assignees: { none: {} } },
          { assignees: { some: { userId } } },
          { createdById: userId },
          { observers: { some: { userId } } },
        ],
      };
    }

    return {
      sectorId,
      OR: [
        { assignees: { some: { userId } } },
        { createdById: userId },
        { observers: { some: { userId } } },
      ],
    };
  }

  async findBySector(
    sectorId: string,
    userId: string,
    isGlobalAdmin: boolean,
    query: FindSectorRequestsQueryDto,
  ): Promise<PaginatedResponseDto<RequestResponseDto>> {
    await this.sectorsService.findOne(sectorId);

    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);
    const visibilityWhere = this.buildSectorVisibilityWhere(
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
      this.toResponseDto(r, userId, isGlobalAdmin, memberships),
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
      : await this.getMemberships(userId);

    const visibilityWhere = this.buildListWhere(
      userId,
      isGlobalAdmin,
      memberships,
    );

    return this.listRequests(visibilityWhere, userId, isGlobalAdmin, query);
  }

  private async getMemberships(
    userId: string,
  ): Promise<MembershipWithSector[]> {
    return this.prisma.userSectorMembership.findMany({
      where: { userId },
      include: { role: true, sector: true },
    });
  }

  private buildListWhere(
    userId: string,
    isGlobalAdmin: boolean,
    memberships: MembershipWithSector[],
  ): Prisma.RequestWhereInput {
    if (isGlobalAdmin) {
      return {};
    }

    const orConditions: Prisma.RequestWhereInput[] = [
      { createdById: userId },
      { observers: { some: { userId } } },
    ];

    const managerSectorIds = memberships
      .filter((m) => m.role.slug === RoleSlug.MANAGER)
      .map((m) => m.sectorId);

    if (managerSectorIds.length > 0) {
      orConditions.push({ sectorId: { in: managerSectorIds } });
    }

    const technicianMemberships = memberships.filter(
      (m) => m.role.slug === RoleSlug.TECHNICIAN,
    );

    const technicianSectorIds = technicianMemberships.map((m) => m.sectorId);

    if (technicianSectorIds.length > 0) {
      orConditions.push({
        AND: [
          { sectorId: { in: technicianSectorIds } },
          { assignees: { some: { userId } } },
        ],
      });
    }

    const openViewSectorIds = technicianMemberships
      .filter((m) => !m.sector.onlyManagerCanView)
      .map((m) => m.sectorId);

    if (openViewSectorIds.length > 0) {
      orConditions.push({
        AND: [
          { sectorId: { in: openViewSectorIds } },
          { assignees: { none: {} } },
        ],
      });
    }

    return { OR: orConditions };
  }

  private resolvePermissions(
    request: RequestWithAccess,
    userId: string,
    isGlobalAdmin: boolean,
    memberships: MembershipWithSector[],
  ): RequestResponseDto['permissions'] {
    if (isGlobalAdmin) {
      return {
        canView: true,
        canEdit: true,
        canArchive: true,
      };
    }

    const isCreator = request.createdById === userId;
    const isAssignee = request.assignees?.some((a) => a.userId === userId) ?? false;
    const isObserver = request.observers?.some((o) => o.userId === userId) ?? false;
    const hasAssignees = (request.assignees?.length ?? 0) > 0;
    const membership = memberships.find((m) => m.sectorId === request.sectorId);
    const isManager = membership?.role.slug === RoleSlug.MANAGER;
    const isTechnician = membership?.role.slug === RoleSlug.TECHNICIAN;
    const sector = membership?.sector;

    const canView =
      isCreator ||
      isObserver ||
      isManager ||
      (isTechnician &&
        (isAssignee || (!sector?.onlyManagerCanView && !hasAssignees)));

    const canEdit =
      canView &&
      (isManager || (isTechnician && !!sector && !sector.onlyManagerCanEdit));

    const canArchive =
      canView &&
      (isManager ||
        (isTechnician && !!sector && !sector.onlyManagerCanArchive));

    return { canView, canEdit, canArchive };
  }

  private toResponseDto(
    request: RequestWithAccess,
    userId: string,
    isGlobalAdmin: boolean,
    memberships: MembershipWithSector[],
  ): RequestResponseDto {
    const assignees =
      request.assignees
        ?.flatMap((assignee) => (assignee.user ? [assignee.user] : [])) ??
      [];
    const observers =
      request.observers
        ?.flatMap((observer) => (observer.user ? [observer.user] : [])) ??
      [];

    return {
      ...request,
      assignees,
      observers,
      permissions: this.resolvePermissions(
        request,
        userId,
        isGlobalAdmin,
        memberships,
      ),
    };
  }

  async findOne(
    id: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<RequestDetailResponseDto> {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);

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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
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
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: requestUserSelect,
            },
          },
        },
        history: {
          orderBy: { createdAt: 'asc' },
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

    const base = this.toResponseDto(request, userId, isGlobalAdmin, memberships);

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
      messages: request.messages.map(({ user, ...message }) => ({
        ...message,
        author: user,
      })),
      history: request.history.map(({ user, ...history }) => ({
        ...history,
        user,
      })),
    };
  }

  async changeStatus(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    newStatus: AllowedStatus,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);

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

    const IMMUTABLE_STATUSES: RequestStatus[] = [RequestStatus.CANCELLED, RequestStatus.ARCHIVED];
    
    if (IMMUTABLE_STATUSES.includes(request.status)) {
      throw new BadRequestException('Não é possível alterar o status de uma solicitação cancelada ou arquivada');
    }

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);

    if (!permissions.canEdit) {
      throw new ForbiddenException('Sem permissão para alterar o status');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.update({
        where: { id: requestId },
        data: { status: newStatus },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });

      await tx.requestHistory.create({
        data: {
          requestId,
          userId,
          action: RequestHistoryAction.STATUS_CHANGED,
          fromStatus: request.status,
          toStatus: newStatus,
        },
      });

      return r;
    });

    return this.toResponseDto(updated, userId, isGlobalAdmin, memberships);
  }

  async findMessages(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<
    Array<{
      id: string;
      content: string;
      createdAt: Date;
      author: { id: string; firstName: string; lastName: string; email: string };
    }>
  > {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);
    if (!permissions.canView) {
      throw new ForbiddenException('Sem permissão para visualizar mensagens');
    }

    const messages = await this.prisma.requestMessage.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: requestUserSelect } },
    });

    return messages.map(({ user, ...msg }) => ({ ...msg, author: user }));
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
    author: { id: string; firstName: string; lastName: string; email: string };
  }> {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);

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

    const permissions = this.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );

    if (!permissions.canEdit) {
      throw new ForbiddenException('Sem permissão para enviar mensagem');
    }

    const message = await this.prisma.requestMessage.create({
      data: { requestId, authorId: userId, content },
      include: { user: { select: requestUserSelect } },
    });

    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      author: message.user,
    };
  }

  async findHistory(requestId: string): Promise<
    Array<{
      id: string;
      action: string;
      fromStatus: string | null;
      toStatus: string | null;
      metadata: unknown;
      createdAt: Date;
      user: { id: string; firstName: string; lastName: string; email: string };
    }>
  > {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    const history = await this.prisma.requestHistory.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: requestUserSelect } },
    });

    return history.map(({ user, ...entry }) => ({ ...entry, user }));
  }

  async update(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    dto: UpdateRequestDto,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);

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

    const IMMUTABLE_STATUSES: RequestStatus[] = [RequestStatus.CANCELLED, RequestStatus.ARCHIVED];
    if (IMMUTABLE_STATUSES.includes(request.status)) {
      throw new BadRequestException('Não é possível editar uma solicitação cancelada ou arquivada');
    }

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);

    if (!permissions.canEdit) {
      throw new ForbiddenException('Sem permissão para editar esta solicitação');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.update({
        where: { id: requestId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });

      if (dto.status !== undefined) {
        await tx.requestHistory.create({
          data: {
            requestId,
            userId,
            action: RequestHistoryAction.STATUS_CHANGED,
            fromStatus: request.status,
            toStatus: dto.status,
          },
        });
      }

      await tx.requestHistory.create({
        data: {
          requestId,
          userId,
          action: RequestHistoryAction.UPDATED,
        },
      });

      return r;
    });

    return this.toResponseDto(updated, userId, isGlobalAdmin, memberships);
  }

  private async fetchRequestForAction(requestId: string) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        assignees: { select: { userId: true } },
        observers: { select: { userId: true } },
      },
    });
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    return request;
  }

  async assign(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    dto: AssignRequestDto,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    const IMMUTABLE_STATUSES: RequestStatus[] = [RequestStatus.CANCELLED, RequestStatus.ARCHIVED];
    if (IMMUTABLE_STATUSES.includes(request.status)) {
      throw new BadRequestException('Não é possível atribuir uma solicitação cancelada ou arquivada');
    }

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);
    if (!permissions.canEdit) {
      throw new ForbiddenException('Sem permissão para atribuir esta solicitação');
    }

    if (!isGlobalAdmin && dto.userIds.length > 0) {
      const sectorMembers = await this.prisma.userSectorMembership.findMany({
        where: { sectorId: request.sectorId, userId: { in: dto.userIds } },
        select: { userId: true },
      });
      if (sectorMembers.length !== dto.userIds.length) {
        throw new BadRequestException('Um ou mais usuários não são membros deste setor');
      }
    }

    const hasAssigneesBefore = request.assignees.length > 0;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestAssignee.deleteMany({ where: { requestId } });

      if (dto.userIds.length > 0) {
        await tx.requestAssignee.createMany({
          data: dto.userIds.map((uid) => ({ requestId, userId: uid })),
        });
      }

      await tx.requestHistory.create({
        data: {
          requestId,
          userId,
          action: hasAssigneesBefore ? RequestHistoryAction.REASSIGNED : RequestHistoryAction.ASSIGNED,
        },
      });

      return tx.request.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });
    });

    return this.toResponseDto(updated, userId, isGlobalAdmin, memberships);
  }

  async setObservers(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    dto: SetObserversDto,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    const IMMUTABLE_STATUSES: RequestStatus[] = [RequestStatus.CANCELLED, RequestStatus.ARCHIVED];
    if (IMMUTABLE_STATUSES.includes(request.status)) {
      throw new BadRequestException('Não é possível alterar observadores de uma solicitação cancelada ou arquivada');
    }

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);
    if (!permissions.canEdit) {
      throw new ForbiddenException('Sem permissão para alterar observadores');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestObserver.deleteMany({ where: { requestId } });

      if (dto.userIds.length > 0) {
        await tx.requestObserver.createMany({
          data: dto.userIds.map((uid) => ({ requestId, userId: uid })),
        });
      }

      await tx.requestHistory.create({
        data: { requestId, userId, action: RequestHistoryAction.UPDATED },
      });

      return tx.request.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });
    });

    return this.toResponseDto(updated, userId, isGlobalAdmin, memberships);
  }

  async cancel(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    if (request.status === RequestStatus.CANCELLED) {
      throw new BadRequestException('Solicitação já está cancelada');
    }
    if (request.status === RequestStatus.ARCHIVED) {
      throw new BadRequestException('Não é possível cancelar uma solicitação arquivada');
    }

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);
    if (!permissions.canEdit) {
      throw new ForbiddenException('Sem permissão para cancelar esta solicitação');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.CANCELLED },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });

      await tx.requestHistory.create({
        data: {
          requestId,
          userId,
          action: RequestHistoryAction.CANCELLED,
          fromStatus: request.status,
          toStatus: RequestStatus.CANCELLED,
        },
      });

      return r;
    });

    return this.toResponseDto(updated, userId, isGlobalAdmin, memberships);
  }

  async archive(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    if (request.status === RequestStatus.ARCHIVED) {
      throw new BadRequestException('Solicitação já está arquivada');
    }
    if (request.status !== RequestStatus.COMPLETED) {
      throw new BadRequestException('Apenas solicitações concluídas podem ser arquivadas');
    }

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);
    if (!permissions.canArchive) {
      throw new ForbiddenException('Sem permissão para arquivar esta solicitação');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.ARCHIVED },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });

      await tx.requestHistory.create({
        data: {
          requestId,
          userId,
          action: RequestHistoryAction.ARCHIVED,
          fromStatus: request.status,
          toStatus: RequestStatus.ARCHIVED,
        },
      });

      return r;
    });

    return this.toResponseDto(updated, userId, isGlobalAdmin, memberships);
  }
}
