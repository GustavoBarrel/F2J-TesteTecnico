import { Injectable } from '@nestjs/common';
import { RequestStatus } from '../../../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestHistoryService } from 'src/request-history/request-history.service';
import { RequestAutoCompleteSettingsService } from './request-auto-complete-settings.service';

@Injectable()
export class RequestAutoCompleteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: RequestAutoCompleteSettingsService,
    private readonly historyService: RequestHistoryService,
  ) {}

  async completeExpiredSolvedRequests(): Promise<number> {
    const { cutoff, value, unit } = await this.settingsService.getDuration();

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

    const systemUserId = await this.resolveHistoryUserId();

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

        await this.historyService.recordAutoCompleted(
          tx,
          req.id,
          systemUserId ?? req.createdById,
          value,
          unit,
        );
      });
    }

    return completedCount;
  }

  private async resolveHistoryUserId(): Promise<string | null> {
    const admin = await this.prisma.user.findFirst({
      where: { isGlobalAdmin: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    return admin?.id ?? null;
  }
}
