import { Test, TestingModule } from '@nestjs/testing';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { RequestStatus } from '../../generated/prisma/client';

const req = {
  user: {
    sub: 'user-1',
    isGlobalAdmin: false,
  },
};

const mockMeService = {
  getMySectors: jest.fn(),
  findMyRequests: jest.fn(),
  findAssignedRequests: jest.fn(),
};

describe('MeController', () => {
  let controller: MeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [{ provide: MeService, useValue: mockMeService }],
    }).compile();

    controller = module.get(MeController);
    jest.clearAllMocks();
  });

  it('deve chamar getMySectors com usuário autenticado e query', async () => {
    const query = { search: 'TI', isActive: true };
    const response = [{ id: 'sector-ti', name: 'TI', statusCounts: [] }];
    mockMeService.getMySectors.mockResolvedValue(response);

    await expect(
      controller.getMySectors(query, req as never),
    ).resolves.toBe(response);

    expect(mockMeService.getMySectors).toHaveBeenCalledWith(
      'user-1',
      false,
      query,
    );
  });

  it('deve chamar findMyRequests com usuário autenticado e filtros', async () => {
    const query = { page: 1, limit: 10, status: RequestStatus.NEW };
    const response = {
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
    mockMeService.findMyRequests.mockResolvedValue(response);

    await expect(
      controller.findMyRequests(query, req as never),
    ).resolves.toBe(response);

    expect(mockMeService.findMyRequests).toHaveBeenCalledWith(
      'user-1',
      false,
      query,
    );
  });

  it('deve chamar findAssignedRequests com usuário autenticado e filtros', async () => {
    const query = { page: 2, limit: 5, sectorId: 'sector-ti' };
    const response = {
      data: [],
      meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
    };
    mockMeService.findAssignedRequests.mockResolvedValue(response);

    await expect(
      controller.findAssigned(query, req as never),
    ).resolves.toBe(response);

    expect(mockMeService.findAssignedRequests).toHaveBeenCalledWith(
      'user-1',
      false,
      query,
    );
  });

  it('deve repassar isGlobalAdmin=true quando o perfil for admin global', async () => {
    const adminReq = {
      user: {
        sub: 'admin-1',
        isGlobalAdmin: true,
      },
    };
    mockMeService.getMySectors.mockResolvedValue([]);

    await controller.getMySectors({}, adminReq as never);

    expect(mockMeService.getMySectors).toHaveBeenCalledWith(
      'admin-1',
      true,
      {},
    );
  });
});
