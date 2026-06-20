import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  Request,
  RequestStatus,
  RoleSlug,
  Sector,
} from '../../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestResponseDto } from '../dto/request-response.dto';
import { LOCKED_REQUEST_STATUSES } from '../constants/requests.constants';
import {
  MembershipWithSector,
  RequestWithAccess,
} from '../types/requests.types';

@Injectable()
export class RequestPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMemberships(userId: string): Promise<MembershipWithSector[]> {
    return this.prisma.userSectorMembership.findMany({
      where: { userId },
      include: { role: true, sector: true },
    });
  }

  buildSectorVisibilityWhere(
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
        OR: [{ createdById: userId }, { observers: { some: { userId } } }],
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

  buildListWhere(
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

  isLockedStatus(status: RequestStatus): boolean {
    return LOCKED_REQUEST_STATUSES.includes(status);
  }

  assertRequestActionsAllowed(request: Request): void {
    if (this.isLockedStatus(request.status)) {
      throw new BadRequestException(
        'Solicitação solucionada, concluída, cancelada ou arquivada permite apenas alteração de status ou revisão da solução',
      );
    }
  }

  resolvePermissions(
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
      request.assignees?.some((assignee) => assignee.userId === userId) ??
      false;
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

  toResponseDto(
    request: RequestWithAccess,
    userId: string,
    isGlobalAdmin: boolean,
    memberships: MembershipWithSector[],
  ): RequestResponseDto {
    const assignees =
      request.assignees?.flatMap((assignee) =>
        assignee.user ? [assignee.user] : [],
      ) ?? [];
    const observers =
      request.observers?.flatMap((observer) =>
        observer.user ? [observer.user] : [],
      ) ?? [];

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

  private resolveBasePermissions(
    request: RequestWithAccess,
    userId: string,
    isGlobalAdmin: boolean,
    memberships: MembershipWithSector[],
  ): Omit<
    RequestResponseDto['permissions'],
    'canChangeStatus' | 'canReviewSolution'
  > {
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
    const isAssignee =
      request.assignees?.some((a) => a.userId === userId) ?? false;
    const isObserver =
      request.observers?.some((o) => o.userId === userId) ?? false;
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

  private canUserChangeStatus(
    request: RequestWithAccess,
    isGlobalAdmin: boolean,
    base: Omit<
      RequestResponseDto['permissions'],
      'canChangeStatus' | 'canReviewSolution'
    >,
    isAssignee: boolean,
    sector?: Sector,
  ): boolean {
    if (isGlobalAdmin || base.canEdit) {
      return true;
    }

    const isOperationalAssigneeInClosedSector =
      isAssignee && base.canView && !!sector?.onlyManagerCanEdit;

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
}
