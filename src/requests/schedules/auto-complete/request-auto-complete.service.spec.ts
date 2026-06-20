import { Test, TestingModule } from '@nestjs/testing';
import { RequestAutoCompleteService } from './request-auto-complete.service';
import { RequestAutoCompleteSettingsService } from './request-auto-complete-settings.service';
import { RequestHistoryService } from 'src/request-history/request-history.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestStatus } from '../../../../generated/prisma/client';

const otherUserId = 'user-2';

const mockPrisma = {
  request: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  requestHistory: {
    create: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAutoCompleteSettingsService = {
  getDuration: jest.fn().mockResolvedValue({
    cutoff: new Date('2026-01-01T00:00:00.000Z'),
    value: 1,
    unit: 'days',
  }),
};

function setupTransaction() {
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
    mockPrisma.request.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.requestHistory.create.mockResolvedValue({});
    return fn(mockPrisma as never);
  });
}

describe('RequestAutoCompleteService', () => {
  let service: RequestAutoCompleteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestAutoCompleteService,
        RequestHistoryService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: RequestAutoCompleteSettingsService,
          useValue: mockAutoCompleteSettingsService,
        },
      ],
    }).compile();

    service = module.get<RequestAutoCompleteService>(RequestAutoCompleteService);
    jest.clearAllMocks();
    mockPrisma.request.findMany.mockResolvedValue([]);
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  describe('completeExpiredSolvedRequests', () => {
    it('retorna 0 quando não há solicitações expiradas', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);

      await expect(service.completeExpiredSolvedRequests()).resolves.toBe(0);
    });

    it('conclui solicitações SOLVED expiradas e grava histórico', async () => {
      mockPrisma.request.findMany.mockResolvedValue([
        { id: 'request-1', createdById: otherUserId },
      ]);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      setupTransaction();

      const count = await service.completeExpiredSolvedRequests();

      expect(count).toBe(1);
      expect(mockPrisma.request.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'request-1',
            status: RequestStatus.SOLVED,
          },
          data: {
            status: RequestStatus.COMPLETED,
            solvedAt: null,
          },
        }),
      );
      expect(mockPrisma.requestHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestId: 'request-1',
            userId: 'admin-1',
            fromStatus: RequestStatus.SOLVED,
            toStatus: RequestStatus.COMPLETED,
          }),
        }),
      );
    });

    it('usa createdById no histórico quando não há admin global', async () => {
      mockPrisma.request.findMany.mockResolvedValue([
        { id: 'request-1', createdById: otherUserId },
      ]);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      setupTransaction();

      await service.completeExpiredSolvedRequests();

      expect(mockPrisma.requestHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: otherUserId,
          }),
        }),
      );
    });

    it('usa duração configurada no settings service', async () => {
      const cutoff = new Date('2026-01-01T00:00:00.000Z');
      mockAutoCompleteSettingsService.getDuration.mockResolvedValue({
        cutoff,
        value: 5,
        unit: 'minutes',
      });

      mockPrisma.request.findMany.mockResolvedValue([]);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await service.completeExpiredSolvedRequests();

      expect(mockAutoCompleteSettingsService.getDuration).toHaveBeenCalled();
      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: RequestStatus.SOLVED,
            solvedAt: { lte: cutoff },
          }),
        }),
      );
    });

    it('não conclui se o chamado já saiu de SOLVED', async () => {
      mockPrisma.request.findMany.mockResolvedValue([
        { id: 'request-1', createdById: otherUserId },
      ]);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          mockPrisma.request.updateMany.mockResolvedValue({ count: 0 });
          return fn(mockPrisma);
        },
      );

      const count = await service.completeExpiredSolvedRequests();

      expect(count).toBe(0);
      expect(mockPrisma.requestHistory.create).not.toHaveBeenCalled();
    });
  });
});
