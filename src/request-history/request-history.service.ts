import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Request, RequestStatus } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
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
  buildSolutionReviewHistory,
  buildStatusChangedHistory,
  extractHistoryDescription,
  HistoryUserSummary,
  RequestHistoryWritePayload,
} from './request-history.helpers';
import { historyUserSelect } from './request-history.constants';

export type RequestHistoryEntry = {
  id: string;
  requestId: string;
  userId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  metadata: unknown;
  description: string | null;
  createdAt: Date;
  user: HistoryUserSummary;
};

export type RequestUpdateHistoryInput = {
  title?: string;
  description?: string;
  priority?: Request['priority'];
};

@Injectable()
export class RequestHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findHistory(requestId: string): Promise<RequestHistoryEntry[]> {
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
      include: { user: { select: historyUserSelect } },
    });

    return this.mapHistoryEntries(history);
  }

  mapHistoryEntries<
    T extends {
      metadata: unknown;
      user: HistoryUserSummary;
    },
  >(entries: T[]) {
    return entries.map(({ user, metadata, ...entry }) => ({
      ...entry,
      metadata,
      description: extractHistoryDescription(metadata),
      user,
    }));
  }

  buildUpdateHistoryEntries(
    request: Request,
    dto: RequestUpdateHistoryInput,
  ): RequestHistoryWritePayload[] {
    const entries: RequestHistoryWritePayload[] = [];

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
      entries.push(buildPriorityChangedHistory(request.priority, dto.priority));
    }

    return entries;
  }

  async fetchUserSummaries(userIds: string[]): Promise<HistoryUserSummary[]> {
    if (userIds.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: historyUserSelect,
    });
  }

  async append(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    entry: RequestHistoryWritePayload,
  ): Promise<void> {
    await tx.requestHistory.create({
      data: {
        requestId,
        userId,
        action: entry.action,
        ...(entry.fromStatus !== undefined
          ? { fromStatus: entry.fromStatus }
          : {}),
        ...(entry.toStatus !== undefined ? { toStatus: entry.toStatus } : {}),
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      },
    });
  }

  async appendMany(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    entries: RequestHistoryWritePayload[],
  ): Promise<void> {
    for (const entry of entries) {
      await this.append(tx, requestId, userId, entry);
    }
  }

  async recordCreated(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    title: string,
    sectorServiceName: string,
    observers: HistoryUserSummary[],
  ): Promise<void> {
    await this.append(
      tx,
      requestId,
      userId,
      buildCreatedHistory(title, sectorServiceName, observers),
    );
  }

  async recordMessageSent(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    messageId: string,
    content: string,
  ): Promise<void> {
    await this.append(
      tx,
      requestId,
      userId,
      buildMessageSentHistory(messageId, content),
    );
  }

  async recordStatusChanged(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    fromStatus: RequestStatus,
    toStatus: RequestStatus,
  ): Promise<void> {
    await this.append(
      tx,
      requestId,
      userId,
      buildStatusChangedHistory(fromStatus, toStatus),
    );
  }

  async recordSolutionReview(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    fromStatus: RequestStatus,
    toStatus: RequestStatus,
    approved: boolean,
  ): Promise<void> {
    await this.append(
      tx,
      requestId,
      userId,
      buildSolutionReviewHistory(fromStatus, toStatus, approved),
    );
  }

  async recordAssign(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    previousUsers: HistoryUserSummary[],
    nextUsers: HistoryUserSummary[],
    reassigned: boolean,
  ): Promise<void> {
    await this.append(
      tx,
      requestId,
      userId,
      buildAssignHistory(previousUsers, nextUsers, reassigned),
    );
  }

  async recordObservers(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    previousUsers: HistoryUserSummary[],
    nextUsers: HistoryUserSummary[],
  ): Promise<void> {
    await this.append(
      tx,
      requestId,
      userId,
      buildObserversHistory(previousUsers, nextUsers),
    );
  }

  async recordCancelled(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    fromStatus: RequestStatus,
  ): Promise<void> {
    await this.append(tx, requestId, userId, buildCancelledHistory(fromStatus));
  }

  async recordArchived(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    fromStatus: RequestStatus,
  ): Promise<void> {
    await this.append(tx, requestId, userId, buildArchivedHistory(fromStatus));
  }

  async recordAutoCompleted(
    tx: Prisma.TransactionClient,
    requestId: string,
    userId: string,
    value: number,
    unit: 'minutes' | 'days',
  ): Promise<void> {
    await this.append(
      tx,
      requestId,
      userId,
      buildAutoCompletedHistory(value, unit),
    );
  }
}
