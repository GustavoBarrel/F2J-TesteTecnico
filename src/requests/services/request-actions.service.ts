import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestResponseDto } from '../dto/request-response.dto';
import { AllowedStatus } from '../dto/change-request-status.dto';
import { AssignRequestDto, SetObserversDto } from '../dto/assign-request.dto';
import { RequestStatus } from '../../../generated/prisma/client';
import { RequestPermissionsService } from './request-permissions.service';
import { RequestHistoryService } from 'src/request-history/request-history.service';
import { usersByIds } from 'src/request-history/request-history.helpers';
import { requestUserSelect } from '../constants/requests.constants';
import { buildSolvedAtUpdate } from '../helpers/request-status.helpers';

@Injectable()
export class RequestActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: RequestPermissionsService,
    private readonly historyService: RequestHistoryService,
  ) {}

  async validateActiveUserIds(userIds: string[]): Promise<void> {
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

  async changeStatus(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    newStatus: AllowedStatus,
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

    const permissions = this.permissionsService.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );

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

      await this.historyService.recordStatusChanged(
        tx,
        requestId,
        userId,
        request.status,
        newStatus,
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

  async reviewSolution(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    approved: boolean,
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

    if (request.status !== RequestStatus.SOLVED) {
      throw new BadRequestException(
        'A revisão da solução só é permitida para solicitações com status SOLVED',
      );
    }

    const permissions = this.permissionsService.resolvePermissions(
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

      await this.historyService.recordSolutionReview(
        tx,
        requestId,
        userId,
        request.status,
        newStatus,
        approved,
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
    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    this.permissionsService.assertRequestActionsAllowed(request);

    const permissions = this.permissionsService.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );
    if (!permissions.canEdit) {
      throw new ForbiddenException(
        'Sem permissão para atribuir esta solicitação',
      );
    }

    if (!isGlobalAdmin && dto.userIds.length > 0) {
      const sectorMembers = await this.prisma.userSectorMembership.findMany({
        where: { sectorId: request.sectorId, userId: { in: dto.userIds } },
        select: { userId: true },
      });
      if (sectorMembers.length !== dto.userIds.length) {
        throw new BadRequestException(
          'Um ou mais usuários não são membros deste setor',
        );
      }
    }

    const hasAssigneesBefore = request.assignees.length > 0;
    const previousAssigneeIds = request.assignees.map(
      (assignee) => assignee.userId,
    );
    const assigneeUsers = await this.historyService.fetchUserSummaries([
      ...new Set([...previousAssigneeIds, ...dto.userIds]),
    ]);
    const previousUsers = usersByIds(assigneeUsers, previousAssigneeIds);
    const nextUsers = usersByIds(assigneeUsers, dto.userIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestAssignee.deleteMany({ where: { requestId } });

      if (dto.userIds.length > 0) {
        await tx.requestAssignee.createMany({
          data: dto.userIds.map((uid) => ({ requestId, userId: uid })),
        });
      }

      await this.historyService.recordAssign(
        tx,
        requestId,
        userId,
        previousUsers,
        nextUsers,
        hasAssigneesBefore,
      );

      return tx.request.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });
    });

    return this.permissionsService.toResponseDto(
      updated,
      userId,
      isGlobalAdmin,
      memberships,
    );
  }

  async setObservers(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    dto: SetObserversDto,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    this.permissionsService.assertRequestActionsAllowed(request);

    const permissions = this.permissionsService.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );
    if (!permissions.canManageObservers) {
      throw new ForbiddenException('Sem permissão para alterar observadores');
    }

    await this.validateActiveUserIds(dto.userIds);

    const previousObserverIds = request.observers.map(
      (observer) => observer.userId,
    );
    const observerUsers = await this.historyService.fetchUserSummaries([
      ...new Set([...previousObserverIds, ...dto.userIds]),
    ]);
    const previousUsers = usersByIds(observerUsers, previousObserverIds);
    const nextUsers = usersByIds(observerUsers, dto.userIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestObserver.deleteMany({ where: { requestId } });

      if (dto.userIds.length > 0) {
        await tx.requestObserver.createMany({
          data: dto.userIds.map((uid) => ({ requestId, userId: uid })),
        });
      }

      await this.historyService.recordObservers(
        tx,
        requestId,
        userId,
        previousUsers,
        nextUsers,
      );

      return tx.request.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          assignees: { include: { user: { select: requestUserSelect } } },
          observers: { include: { user: { select: requestUserSelect } } },
        },
      });
    });

    return this.permissionsService.toResponseDto(
      updated,
      userId,
      isGlobalAdmin,
      memberships,
    );
  }

  async cancel(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    if (request.status === RequestStatus.CANCELLED) {
      throw new BadRequestException('Solicitação já está cancelada');
    }
    if (request.status === RequestStatus.ARCHIVED) {
      throw new BadRequestException(
        'Não é possível cancelar uma solicitação arquivada',
      );
    }
    if (request.status === RequestStatus.COMPLETED) {
      throw new BadRequestException(
        'Não é possível cancelar uma solicitação concluída',
      );
    }
    if (request.status === RequestStatus.SOLVED) {
      throw new BadRequestException(
        'Não é possível cancelar uma solicitação aguardando revisão da solução',
      );
    }

    const permissions = this.permissionsService.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );
    if (!permissions.canEdit) {
      throw new ForbiddenException(
        'Sem permissão para cancelar esta solicitação',
      );
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

      await this.historyService.recordCancelled(
        tx,
        requestId,
        userId,
        request.status,
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

  async archive(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
  ): Promise<RequestResponseDto> {
    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    if (request.status === RequestStatus.ARCHIVED) {
      throw new BadRequestException('Solicitação já está arquivada');
    }
    if (request.status !== RequestStatus.COMPLETED) {
      throw new BadRequestException(
        'Apenas solicitações concluídas podem ser arquivadas',
      );
    }

    const permissions = this.permissionsService.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );
    if (!permissions.canArchive) {
      throw new ForbiddenException(
        'Sem permissão para arquivar esta solicitação',
      );
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

      await this.historyService.recordArchived(
        tx,
        requestId,
        userId,
        request.status,
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

  private async fetchRequestForAction(requestId: string) {
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
    return request;
  }
}
