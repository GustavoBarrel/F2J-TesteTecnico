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
  PaginationQueryDto,
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
import {
  FindAllRequestsQueryDto,
  FindSectorRequestsQueryDto,
} from './dto/find-all-requests-query.dto';
import { AllowedStatus } from './dto/change-request-status.dto';
import { AssignRequestDto, SetObserversDto } from './dto/assign-request.dto';
import { RequestAutoCompleteSettingsService } from './request-auto-complete-settings.service';
import {
  buildArchivedHistory,
  buildAssignHistory,
  buildAutoCompletedHistory,
  buildCancelledHistory,
  buildCreatedHistory,
  buildFieldUpdatedHistory,
  buildMessageSentHistory,
  buildObserversHistory,
  buildPriorityChangedHistory,
  buildStatusChangedHistory,
  extractHistoryDescription,
  HistoryUserSummary,
  historyMetadata,
  usersByIds,
} from './request-history.helpers';

type MembershipWithSector = UserSectorMembership & {
  role: Role;
  sector: Sector;
};

type RequestUserSummary = {
  id: string;
  username: string;
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
  username: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

const LOCKED_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.SOLVED,
  RequestStatus.COMPLETED,
  RequestStatus.CANCELLED,
  RequestStatus.ARCHIVED,
];

function buildSolvedAtUpdate(
  fromStatus: RequestStatus,
  toStatus: RequestStatus,
): Pick<Prisma.RequestUpdateInput, 'solvedAt'> {
  if (toStatus === RequestStatus.SOLVED && fromStatus !== RequestStatus.SOLVED) {
    return { solvedAt: new Date() };
  }

  if (fromStatus === RequestStatus.SOLVED && toStatus !== RequestStatus.SOLVED) {
    return { solvedAt: null };
  }

  return {};
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sectorsService: SectorsService,
    private readonly autoCompleteSettingsService: RequestAutoCompleteSettingsService,
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
    await this.validateActiveUserIds(observerIds);
    const observerUsers = await this.fetchUserSummaries(observerIds);
    const createdHistory = buildCreatedHistory(
      createRequestDto.title,
      sectorService.name,
      observerUsers,
    );

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

      await tx.requestHistory.create({
        data: {
          requestId: request.id,
          userId,
          ...createdHistory,
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
      {
        OR: [
          { createdById: userId },
          { observers: { some: { userId } } },
        ],
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

  private isLockedStatus(status: RequestStatus): boolean {
    return LOCKED_REQUEST_STATUSES.includes(status);
  }

  private assertRequestActionsAllowed(request: Request): void {
    if (this.isLockedStatus(request.status)) {
      throw new BadRequestException(
        'Solicitação solucionada, concluída, cancelada ou arquivada permite apenas alteração de status ou revisão da solução',
      );
    }
  }

  private resolveBasePermissions(
    request: RequestWithAccess,
    userId: string,
    isGlobalAdmin: boolean,
    memberships: MembershipWithSector[],
  ): Omit<RequestResponseDto['permissions'], 'canChangeStatus' | 'canReviewSolution'> {
    if (isGlobalAdmin) {
      return {
        canView: true,
        canEdit: true,
        canMessage: true,
        canArchive: true,
        canManageObservers: true,
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

    const canManageObservers = isCreator || isManager || isAssignee;

    const canMessage = isCreator || isManager || isAssignee;

    return { canView, canEdit, canMessage, canArchive, canManageObservers };
  }

  private resolvePermissions(
    request: RequestWithAccess,
    userId: string,
    isGlobalAdmin: boolean,
    memberships: MembershipWithSector[],
  ): RequestResponseDto['permissions'] {
    const base = this.resolveBasePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );
    const isCreator = request.createdById === userId;
    const isAssignee =
      request.assignees?.some((assignee) => assignee.userId === userId) ?? false;
    const membership = memberships.find((m) => m.sectorId === request.sectorId);
    const canChangeStatus = this.canUserChangeStatus(
      request,
      isGlobalAdmin,
      base,
      isAssignee,
      membership?.sector,
    );

    if (request.status === RequestStatus.SOLVED) {
      return {
        canView: base.canView,
        canEdit: false,
        canMessage: false,
        canManageObservers: false,
        canArchive: false,
        canChangeStatus: isGlobalAdmin,
        canReviewSolution: isGlobalAdmin || isCreator,
      };
    }

    if (!this.isLockedStatus(request.status)) {
      return { ...base, canChangeStatus, canReviewSolution: false };
    }

    return {
      canView: base.canView,
      canEdit: false,
      canMessage: false,
      canManageObservers: false,
      canArchive:
        request.status === RequestStatus.COMPLETED &&
        (isGlobalAdmin || base.canArchive),
      canChangeStatus,
      canReviewSolution: false,
    };
  }

  private canUserChangeStatus(
    request: RequestWithAccess,
    isGlobalAdmin: boolean,
    base: Omit<RequestResponseDto['permissions'], 'canChangeStatus' | 'canReviewSolution'>,
    isAssignee: boolean,
    sector?: Sector,
  ): boolean {
    if (isGlobalAdmin || base.canEdit) {
      return true;
    }

    const isOperationalAssigneeInClosedSector =
      isAssignee &&
      base.canView &&
      !!sector?.onlyManagerCanEdit;

    if (
      isOperationalAssigneeInClosedSector &&
      !this.isLockedStatus(request.status)
    ) {
      return true;
    }

    if (this.isLockedStatus(request.status)) {
      return false;
    }

    return false;
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
      history: this.mapHistoryEntries(request.history),
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

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);

    if (!permissions.canChangeStatus) {
      throw new ForbiddenException('Sem permissão para alterar o status');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          ...buildSolvedAtUpdate(request.status, newStatus),
        },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });

      await tx.requestHistory.create({
        data: {
          requestId,
          userId,
          ...buildStatusChangedHistory(request.status, newStatus),
        },
      });

      return r;
    });

    return this.toResponseDto(updated, userId, isGlobalAdmin, memberships);
  }

  async autoCompleteExpiredSolvedRequests(): Promise<number> {
    const { cutoff, value, unit } = await this.autoCompleteSettingsService.getDuration();

    const expired = await this.prisma.request.findMany({
      where: {
        status: RequestStatus.SOLVED,
        solvedAt: { lte: cutoff },
      },
      select: { id: true, createdById: true },
    });

    if (expired.length === 0) {
      return 0;
    }

    const systemUserId = await this.resolveAutoCompleteHistoryUserId();
    const history = buildAutoCompletedHistory(value, unit);

    let completedCount = 0;

    for (const req of expired) {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.request.updateMany({
          where: {
            id: req.id,
            status: RequestStatus.SOLVED,
          },
          data: {
            status: RequestStatus.COMPLETED,
            solvedAt: null,
          },
        });

        if (updated.count === 0) {
          return;
        }

        completedCount += updated.count;

        await tx.requestHistory.create({
          data: {
            requestId: req.id,
            userId: systemUserId ?? req.createdById,
            ...history,
          },
        });
      });
    }

    return completedCount;
  }

  async reviewSolution(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    approved: boolean,
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

    if (request.status !== RequestStatus.SOLVED) {
      throw new BadRequestException(
        'A revisão da solução só é permitida para solicitações com status SOLVED',
      );
    }

    const permissions = this.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );

    if (!permissions.canReviewSolution) {
      throw new ForbiddenException('Sem permissão para revisar a solução');
    }

    const newStatus = approved
      ? RequestStatus.COMPLETED
      : RequestStatus.IN_PROGRESS;

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          solvedAt: null,
        },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });

      const statusHistory = buildStatusChangedHistory(request.status, newStatus);

      await tx.requestHistory.create({
        data: {
          requestId,
          userId,
          action: statusHistory.action,
          fromStatus: statusHistory.fromStatus,
          toStatus: statusHistory.toStatus,
          metadata: historyMetadata(
            approved
              ? 'Solução aprovada pelo requerente. Solicitação concluída.'
              : 'Solução rejeitada pelo requerente. Solicitação retornou para em andamento.',
            {
              approved,
              fromStatus: request.status,
              toStatus: newStatus,
              kind: approved ? 'SOLUTION_APPROVED' : 'SOLUTION_REJECTED',
            },
          ),
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
    query: PaginationQueryDto,
  ): Promise<
    PaginatedResponseDto<{
      id: string;
      content: string;
      createdAt: Date;
      author: { id: string; username: string; firstName: string; lastName: string; email: string };
    }>
  > {
    const memberships = isGlobalAdmin ? [] : await this.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);
    if (!permissions.canView) {
      throw new ForbiddenException('Sem permissão para visualizar mensagens');
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where = { requestId };

    const [messages, total] = await Promise.all([
      this.prisma.requestMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: { user: { select: requestUserSelect } },
      }),
      this.prisma.requestMessage.count({ where }),
    ]);

    return {
      data: messages.map(({ user, ...msg }) => ({ ...msg, author: user })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    author: { id: string; username: string; firstName: string; lastName: string; email: string };
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

    this.assertRequestActionsAllowed(request);

    const permissions = this.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );

    if (!permissions.canMessage) {
      throw new ForbiddenException('Sem permissão para enviar mensagem');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const createdMessage = await tx.requestMessage.create({
        data: { requestId, authorId: userId, content },
        include: { user: { select: requestUserSelect } },
      });

      await tx.requestHistory.create({
        data: {
          requestId,
          userId,
          ...buildMessageSentHistory(createdMessage.id, content),
        },
      });

      return createdMessage;
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
      description: string | null;
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

    return this.mapHistoryEntries(history);
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

    this.assertRequestActionsAllowed(request);

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);

    if (!permissions.canEdit) {
      throw new ForbiddenException('Sem permissão para editar esta solicitação');
    }

    const historyEntries = this.buildUpdateHistoryEntries(request, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const statusUpdate =
        dto.status !== undefined && dto.status !== request.status
          ? buildSolvedAtUpdate(request.status, dto.status)
          : {};

      const r = await tx.request.update({
        where: { id: requestId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...statusUpdate,
        },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });

      for (const entry of historyEntries) {
        await tx.requestHistory.create({
          data: {
            requestId,
            userId,
            ...entry,
          },
        });
      }

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

    this.assertRequestActionsAllowed(request);

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
    const previousAssigneeIds = request.assignees.map((assignee) => assignee.userId);
    const assigneeUsers = await this.fetchUserSummaries([
      ...new Set([...previousAssigneeIds, ...dto.userIds]),
    ]);
    const assignHistory = buildAssignHistory(
      usersByIds(assigneeUsers, previousAssigneeIds),
      usersByIds(assigneeUsers, dto.userIds),
      hasAssigneesBefore,
    );

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
          ...assignHistory,
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

    this.assertRequestActionsAllowed(request);

    const permissions = this.resolvePermissions(request, userId, isGlobalAdmin, memberships);
    if (!permissions.canManageObservers) {
      throw new ForbiddenException('Sem permissão para alterar observadores');
    }

    await this.validateActiveUserIds(dto.userIds);

    const previousObserverIds = request.observers.map((observer) => observer.userId);
    const observerUsers = await this.fetchUserSummaries([
      ...new Set([...previousObserverIds, ...dto.userIds]),
    ]);
    const observersHistory = buildObserversHistory(
      usersByIds(observerUsers, previousObserverIds),
      usersByIds(observerUsers, dto.userIds),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestObserver.deleteMany({ where: { requestId } });

      if (dto.userIds.length > 0) {
        await tx.requestObserver.createMany({
          data: dto.userIds.map((uid) => ({ requestId, userId: uid })),
        });
      }

      await tx.requestHistory.create({
        data: {
          requestId,
          userId,
          ...observersHistory,
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
    if (request.status === RequestStatus.COMPLETED) {
      throw new BadRequestException('Não é possível cancelar uma solicitação concluída');
    }
    if (request.status === RequestStatus.SOLVED) {
      throw new BadRequestException('Não é possível cancelar uma solicitação aguardando revisão da solução');
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
          ...buildCancelledHistory(request.status),
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
          ...buildArchivedHistory(request.status),
        },
      });

      return r;
    });

    return this.toResponseDto(updated, userId, isGlobalAdmin, memberships);
  }

  private mapHistoryEntries<
    T extends {
      metadata: unknown;
      user: RequestUserSummary;
    },
  >(entries: T[]) {
    return entries.map(({ user, metadata, ...entry }) => ({
      ...entry,
      metadata,
      description: extractHistoryDescription(metadata),
      user,
    }));
  }

  private async fetchUserSummaries(
    userIds: string[],
  ): Promise<HistoryUserSummary[]> {
    if (userIds.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: requestUserSelect,
    });
  }

  private buildUpdateHistoryEntries(
    request: Request,
    dto: UpdateRequestDto,
  ): Array<{
    action: RequestHistoryAction;
    fromStatus?: RequestStatus;
    toStatus?: RequestStatus;
    metadata: ReturnType<typeof buildFieldUpdatedHistory>['metadata'];
  }> {
    const entries: Array<{
      action: RequestHistoryAction;
      fromStatus?: RequestStatus;
      toStatus?: RequestStatus;
      metadata: ReturnType<typeof buildFieldUpdatedHistory>['metadata'];
    }> = [];

    if (dto.title !== undefined && dto.title !== request.title) {
      entries.push(buildFieldUpdatedHistory('title', request.title, dto.title));
    }

    if (
      dto.description !== undefined &&
      dto.description !== request.description
    ) {
      entries.push(
        buildFieldUpdatedHistory(
          'description',
          request.description,
          dto.description,
        ),
      );
    }

    if (dto.priority !== undefined && dto.priority !== request.priority) {
      entries.push(
        buildPriorityChangedHistory(request.priority, dto.priority),
      );
    }

    if (dto.status !== undefined && dto.status !== request.status) {
      entries.push(buildStatusChangedHistory(request.status, dto.status));
    }

    return entries;
  }

  private async validateActiveUserIds(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const uniqueIds = new Set(userIds);
    if (uniqueIds.size !== userIds.length) {
      throw new BadRequestException('IDs de usuário duplicados');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true },
    });

    if (users.length !== userIds.length) {
      throw new BadRequestException(
        'Um ou mais usuários não encontrados ou estão inativos',
      );
    }
  }

  private async resolveAutoCompleteHistoryUserId(): Promise<string | null> {
    const admin = await this.prisma.user.findFirst({
      where: { isGlobalAdmin: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    return admin?.id ?? null;
  }
}
