import { Test, TestingModule } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectorsService } from 'src/sectors/sectors.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Request,
  RequestPriority,
  RequestStatus,
  Role,
  RoleSlug,
  Sector,
} from '../../generated/prisma/client';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const userId = 'user-1';
const otherUserId = 'user-2';

const baseSector: Sector = {
  id: 'sector-ti',
  name: 'TI',
  onlyManagerCanView: true,
  onlyManagerCanEdit: true,
  onlyManagerCanArchive: true,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const openSector: Sector = {
  ...baseSector,
  id: 'sector-open',
  name: 'Atendimento',
  onlyManagerCanView: false,
  onlyManagerCanEdit: false,
  onlyManagerCanArchive: false,
};

const managerRole: Role = {
  id: 'role-manager',
  name: 'Manager',
  description: 'Manager',
  slug: RoleSlug.MANAGER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const technicianRole: Role = {
  ...managerRole,
  id: 'role-technician',
  name: 'Technician',
  slug: RoleSlug.TECHNICIAN,
};

const membership = (sector: Sector, role: Role) => ({
  id: `membership-${sector.id}`,
  userId,
  sectorId: sector.id,
  roleId: role.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  role,
  sector,
});

type RequestFixture = Request & {
  assignees?: Array<{
    userId: string;
    user?: { id: string; firstName: string; lastName: string; email: string };
  }>;
  observers?: Array<{
    userId: string;
    user?: { id: string; firstName: string; lastName: string; email: string };
  }>;
};

const userSummary = (id: string) => ({
  id,
  firstName: 'User',
  lastName: id,
  email: `${id}@email.com`,
});

const request = (overrides: Partial<RequestFixture> = {}): RequestFixture => ({
  id: 'request-1',
  title: 'Chamado',
  description: 'Descrição',
  status: RequestStatus.NEW,
  priority: RequestPriority.MEDIUM,
  sectorId: baseSector.id,
  sectorServiceId: 'service-1',
  createdById: otherUserId,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  assignees: [],
  observers: [],
  ...overrides,
});

const requestWithRelations = (overrides: Partial<RequestFixture> = {}) => ({
  ...request(overrides),
  sector: {
    id: (overrides.sectorId ?? baseSector.id) === openSector.id ? openSector.id : baseSector.id,
    name: 'TI',
    onlyManagerCanView: baseSector.onlyManagerCanView,
    onlyManagerCanEdit: baseSector.onlyManagerCanEdit,
    onlyManagerCanArchive: baseSector.onlyManagerCanArchive,
  },
  sectorService: { id: 'service-1', name: 'Serviço' },
  createdBy: userSummary(otherUserId),
  messages: [],
  history: [],
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  request: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  requestHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  requestMessage: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  requestAssignee: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  requestObserver: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  userSectorMembership: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  sectorService: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockSectorsService = {
  findOne: jest.fn(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupTransaction(returnValue: unknown) {
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
    mockPrisma.request.update.mockResolvedValue(returnValue);
    mockPrisma.request.findUniqueOrThrow.mockResolvedValue(returnValue);
    mockPrisma.requestHistory.create.mockResolvedValue({});
    mockPrisma.requestMessage.create.mockResolvedValue(returnValue);
    mockPrisma.requestAssignee.deleteMany.mockResolvedValue({});
    mockPrisma.requestAssignee.createMany.mockResolvedValue({});
    mockPrisma.requestObserver.deleteMany.mockResolvedValue({});
    mockPrisma.requestObserver.createMany.mockResolvedValue({});
    return fn(mockPrisma as never);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RequestsService', () => {
  let service: RequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SectorsService, useValue: mockSectorsService },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
    jest.clearAllMocks();
    mockPrisma.request.findMany.mockResolvedValue([]);
    mockPrisma.request.count.mockResolvedValue(0);
    mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      title: 'Chamado',
      description: 'Descrição',
      sectorServiceId: 'service-1',
    };

    beforeEach(() => {
      mockPrisma.sectorService.findUnique.mockResolvedValue({
        id: 'service-1',
        sectorId: baseSector.id,
        isActive: true,
        name: 'Serviço',
      });
      mockSectorsService.findOne.mockResolvedValue(baseSector);
    });

    it('cria solicitação com observadores na abertura', async () => {
      const created = request({ createdById: userId });
      mockPrisma.user.findMany.mockResolvedValue([
        { id: otherUserId, firstName: 'User', lastName: otherUserId, email: `${otherUserId}@email.com` },
      ]);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.request.create.mockResolvedValue(created);
        mockPrisma.requestObserver.createMany.mockResolvedValue({ count: 1 });
        mockPrisma.requestHistory.create.mockResolvedValue({});
        return fn(mockPrisma as never);
      });
      mockPrisma.request.findUnique.mockResolvedValue(
        requestWithRelations({
          createdById: userId,
          observers: [{ userId: otherUserId, user: userSummary(otherUserId) }],
        }),
      );

      await service.create(
        { ...createDto, observerIds: [otherUserId] },
        userId,
        false,
      );

      expect(mockPrisma.requestObserver.createMany).toHaveBeenCalledWith({
        data: [{ requestId: created.id, userId: otherUserId }],
      });
    });

    it('rejeita observerIds com usuário inativo ou inexistente', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await expect(
        service.create({ ...createDto, observerIds: ['invalid-user'] }, userId, false),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll - visibilidade da lista geral', () => {
    it('admin global vê tudo e não busca memberships', async () => {
      mockPrisma.request.findMany.mockResolvedValue([
        request({ sectorId: 'any-sector' }),
      ]);
      mockPrisma.request.count.mockResolvedValue(1);

      const result = await service.findAll(userId, true, { page: 1, limit: 10 });

      expect(mockPrisma.userSectorMembership.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{}, {}] },
          skip: 0,
          take: 10,
        }),
      );
      expect(result.data[0].permissions).toEqual({
        canView: true,
        canEdit: true,
        canArchive: true,
        canManageObservers: true,
      });
    });

    it('sempre inclui requests criados pelo próprio usuário', async () => {
      mockPrisma.request.findMany.mockResolvedValue([
        request({ createdById: userId, sectorId: 'external-sector' }),
      ]);
      mockPrisma.request.count.mockResolvedValue(1);

      const result = await service.findAll(userId, false, {});

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { createdById: userId },
                  { observers: { some: { userId } } },
                ],
              },
              {},
            ],
          },
        }),
      );
      expect(result.data[0].permissions).toEqual({
        canView: true,
        canEdit: false,
        canArchive: false,
        canManageObservers: true,
      });
    });

    it('manager vê todos os requests do setor e pode editar/arquivar', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(baseSector, managerRole),
      ]);
      mockPrisma.request.findMany.mockResolvedValue([
        request({ sectorId: baseSector.id }),
      ]);
      mockPrisma.request.count.mockResolvedValue(1);

      const result = await service.findAll(userId, false, {});

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { createdById: userId },
                  { observers: { some: { userId } } },
                  { sectorId: { in: [baseSector.id] } },
                ],
              },
              {},
            ],
          },
        }),
      );
      expect(result.data[0].permissions).toEqual({
        canView: true,
        canEdit: true,
        canArchive: true,
        canManageObservers: true,
      });
    });

    it('technician vê fila do setor quando onlyManagerCanView é false', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(openSector, technicianRole),
      ]);
      mockPrisma.request.findMany.mockResolvedValue([
        request({ sectorId: openSector.id, assignees: [] }),
      ]);
      mockPrisma.request.count.mockResolvedValue(1);

      const result = await service.findAll(userId, false, {});

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { createdById: userId },
                  { observers: { some: { userId } } },
                  {
                    AND: [
                      { sectorId: { in: [openSector.id] } },
                      { assignees: { some: { userId } } },
                    ],
                  },
                  {
                    AND: [
                      { sectorId: { in: [openSector.id] } },
                      { assignees: { none: {} } },
                    ],
                  },
                ],
              },
              {},
            ],
          },
        }),
      );
      expect(result.data[0].permissions).toEqual({
        canView: true,
        canEdit: true,
        canArchive: true,
        canManageObservers: false,
      });
    });

    it('technician vê apenas atribuídos quando onlyManagerCanView é true', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(baseSector, technicianRole),
      ]);
      mockPrisma.request.findMany.mockResolvedValue([
        request({
          sectorId: baseSector.id,
          assignees: [{ userId, user: userSummary(userId) }],
        }),
      ]);
      mockPrisma.request.count.mockResolvedValue(1);

      const result = await service.findAll(userId, false, {});

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { createdById: userId },
                  { observers: { some: { userId } } },
                  {
                    AND: [
                      { sectorId: { in: [baseSector.id] } },
                      { assignees: { some: { userId } } },
                    ],
                  },
                ],
              },
              {},
            ],
          },
        }),
      );
      expect(result.data[0].permissions).toEqual({
        canView: true,
        canEdit: false,
        canArchive: false,
        canManageObservers: false,
      });
    });

    it('aplica filtros de sectorId e status junto da visibilidade', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(openSector, technicianRole),
      ]);

      await service.findAll(userId, false, {
        sectorId: openSector.id,
        status: RequestStatus.IN_PROGRESS,
      });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              expect.objectContaining({ OR: expect.any(Array) }),
              { sectorId: openSector.id, status: RequestStatus.IN_PROGRESS },
            ],
          },
        }),
      );
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne - controle de acesso', () => {
    it('lança NotFoundException se request não existe', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id', userId, false)).rejects.toThrow(NotFoundException);
    });

    it('admin pode ver qualquer request', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(requestWithRelations());

      const result = await service.findOne('request-1', userId, true);

      expect(result.permissions).toEqual({
        canView: true,
        canEdit: true,
        canArchive: true,
        canManageObservers: true,
      });
    });

    it('manager do setor pode ver qualquer request do setor', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, managerRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(requestWithRelations());

      const result = await service.findOne('request-1', userId, false);

      expect(result.permissions.canView).toBe(true);
    });

    it('criador do request pode sempre ver', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
      mockPrisma.request.findUnique.mockResolvedValue(
        requestWithRelations({ createdById: userId }),
      );

      const result = await service.findOne('request-1', userId, false);

      expect(result.permissions.canView).toBe(true);
    });

    it('observer pode ver o request', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
      mockPrisma.request.findUnique.mockResolvedValue(
        requestWithRelations({ observers: [{ userId, user: userSummary(userId) }] }),
      );

      const result = await service.findOne('request-1', userId, false);

      expect(result.permissions.canView).toBe(true);
    });

    it('technician atribuído em setor fechado pode ver mas não editar', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        requestWithRelations({ assignees: [{ userId, user: userSummary(userId) }] }),
      );

      const result = await service.findOne('request-1', userId, false);

      expect(result.permissions).toEqual({
        canView: true,
        canEdit: false,
        canArchive: false,
        canManageObservers: false,
      });
    });

    it('technician não atribuído em setor fechado recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        requestWithRelations({ assignees: [], createdById: otherUserId }),
      );

      await expect(service.findOne('request-1', userId, false)).rejects.toThrow(ForbiddenException);
    });

    it('usuário sem vínculo e sem relação recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
      mockPrisma.request.findUnique.mockResolvedValue(
        requestWithRelations({ createdById: otherUserId, assignees: [], observers: [] }),
      );

      await expect(service.findOne('request-1', userId, false)).rejects.toThrow(ForbiddenException);
    });

    it('technician em setor aberto pode ver request da fila (sem atribuído)', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(openSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        requestWithRelations({ sectorId: openSector.id, assignees: [] }),
      );

      const result = await service.findOne('request-1', userId, false);

      expect(result.permissions.canView).toBe(true);
    });
  });

  // ─── changeStatus ─────────────────────────────────────────────────────────

  describe('changeStatus - controle de acesso', () => {
    const updatedReq = request({ status: RequestStatus.IN_PROGRESS });

    it('admin pode alterar status', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request());
      setupTransaction(updatedReq);

      await expect(
        service.changeStatus('request-1', userId, true, RequestStatus.IN_PROGRESS),
      ).resolves.toBeDefined();
    });

    it('technician com canEdit pode alterar status (setor aberto)', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(openSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ sectorId: openSector.id, assignees: [] }),
      );
      setupTransaction(request({ sectorId: openSector.id, status: RequestStatus.IN_PROGRESS }));

      await expect(
        service.changeStatus('request-1', userId, false, RequestStatus.IN_PROGRESS),
      ).resolves.toBeDefined();
    });

    it('technician sem canEdit recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ assignees: [{ userId, user: userSummary(userId) }] }),
      );

      await expect(
        service.changeStatus('request-1', userId, false, RequestStatus.IN_PROGRESS),
      ).rejects.toThrow(ForbiddenException);
    });

    it('request CANCELLED não pode ter status alterado', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ status: RequestStatus.CANCELLED }),
      );

      await expect(
        service.changeStatus('request-1', userId, true, RequestStatus.IN_PROGRESS),
      ).rejects.toThrow(BadRequestException);
    });

    it('request ARCHIVED não pode ter status alterado', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ status: RequestStatus.ARCHIVED }),
      );

      await expect(
        service.changeStatus('request-1', userId, true, RequestStatus.IN_PROGRESS),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update - controle de acesso', () => {
    it('admin pode editar qualquer request', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request());
      setupTransaction(request({ title: 'Novo título' }));

      await expect(
        service.update('request-1', userId, true, { title: 'Novo título' }),
      ).resolves.toBeDefined();
    });

    it('technician sem canEdit recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ assignees: [{ userId, user: userSummary(userId) }] }),
      );

      await expect(
        service.update('request-1', userId, false, { title: 'Novo título' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('request CANCELLED não pode ser editado', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ status: RequestStatus.CANCELLED }),
      );

      await expect(
        service.update('request-1', userId, true, { title: 'Novo título' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('request ARCHIVED não pode ser editado', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ status: RequestStatus.ARCHIVED }),
      );

      await expect(
        service.update('request-1', userId, true, { title: 'Novo título' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('manager pode editar título, descrição e prioridade', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, managerRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(request());
      setupTransaction(request({ title: 'Atualizado', priority: RequestPriority.HIGH }));

      await expect(
        service.update('request-1', userId, false, {
          title: 'Atualizado',
          priority: RequestPriority.HIGH,
        }),
      ).resolves.toBeDefined();
      expect(mockPrisma.request.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Atualizado', priority: RequestPriority.HIGH }),
        }),
      );
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────────────

  describe('cancel - controle de acesso', () => {
    it('admin pode cancelar', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request());
      setupTransaction(request({ status: RequestStatus.CANCELLED }));

      await expect(service.cancel('request-1', userId, true)).resolves.toBeDefined();
    });

    it('technician com canEdit pode cancelar (setor aberto)', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(openSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(request({ sectorId: openSector.id }));
      setupTransaction(request({ sectorId: openSector.id, status: RequestStatus.CANCELLED }));

      await expect(service.cancel('request-1', userId, false)).resolves.toBeDefined();
    });

    it('technician sem canEdit recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ assignees: [{ userId, user: userSummary(userId) }] }),
      );

      await expect(service.cancel('request-1', userId, false)).rejects.toThrow(ForbiddenException);
    });

    it('request já CANCELLED lança BadRequestException', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request({ status: RequestStatus.CANCELLED }));

      await expect(service.cancel('request-1', userId, true)).rejects.toThrow(BadRequestException);
    });

    it('request ARCHIVED não pode ser cancelado', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request({ status: RequestStatus.ARCHIVED }));

      await expect(service.cancel('request-1', userId, true)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── archive ──────────────────────────────────────────────────────────────

  describe('archive - controle de acesso', () => {
    it('admin pode arquivar request COMPLETED', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request({ status: RequestStatus.COMPLETED }));
      setupTransaction(request({ status: RequestStatus.ARCHIVED }));

      await expect(service.archive('request-1', userId, true)).resolves.toBeDefined();
    });

    it('technician com canArchive pode arquivar (setor aberto, COMPLETED)', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(openSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ sectorId: openSector.id, status: RequestStatus.COMPLETED }),
      );
      setupTransaction(request({ sectorId: openSector.id, status: RequestStatus.ARCHIVED }));

      await expect(service.archive('request-1', userId, false)).resolves.toBeDefined();
    });

    it('technician sem canArchive recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ status: RequestStatus.COMPLETED, assignees: [{ userId, user: userSummary(userId) }] }),
      );

      await expect(service.archive('request-1', userId, false)).rejects.toThrow(ForbiddenException);
    });

    it('request não COMPLETED lança BadRequestException', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request({ status: RequestStatus.IN_PROGRESS }));

      await expect(service.archive('request-1', userId, true)).rejects.toThrow(BadRequestException);
    });

    it('request já ARCHIVED lança BadRequestException', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request({ status: RequestStatus.ARCHIVED }));

      await expect(service.archive('request-1', userId, true)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── assign ───────────────────────────────────────────────────────────────

  describe('assign - controle de acesso', () => {
    it('admin pode atribuir qualquer usuário sem validar membership', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request());
      mockPrisma.user.findMany.mockResolvedValue([
        userSummary('any-user'),
      ]);
      setupTransaction(request({ assignees: [{ userId: 'any-user', user: userSummary('any-user') }] }));

      await expect(
        service.assign('request-1', userId, true, { userIds: ['any-user'] }),
      ).resolves.toBeDefined();
      expect(mockPrisma.userSectorMembership.findMany).not.toHaveBeenCalled();
    });

    it('technician sem canEdit recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ assignees: [{ userId, user: userSummary(userId) }] }),
      );

      await expect(
        service.assign('request-1', userId, false, { userIds: [otherUserId] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('userId fora do setor lança BadRequestException', async () => {
      mockPrisma.userSectorMembership.findMany
        .mockResolvedValueOnce([membership(openSector, technicianRole)])
        .mockResolvedValueOnce([]);

      mockPrisma.request.findUnique.mockResolvedValue(request({ sectorId: openSector.id }));

      await expect(
        service.assign('request-1', userId, false, { userIds: ['outsider-user'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('request CANCELLED não pode ser atribuído', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request({ status: RequestStatus.CANCELLED }));

      await expect(
        service.assign('request-1', userId, true, { userIds: [otherUserId] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── setObservers ─────────────────────────────────────────────────────────

  describe('setObservers - controle de acesso', () => {
    it('admin pode definir observadores', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request());
      mockPrisma.user.findMany.mockResolvedValue([{ id: otherUserId }]);
      setupTransaction(request({ observers: [{ userId: otherUserId, user: userSummary(otherUserId) }] }));

      await expect(
        service.setObservers('request-1', userId, true, { userIds: [otherUserId] }),
      ).resolves.toBeDefined();
    });

    it('criador pode definir observadores mesmo sem canEdit', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ createdById: userId }),
      );
      mockPrisma.user.findMany.mockResolvedValue([{ id: otherUserId }]);
      setupTransaction(
        request({
          createdById: userId,
          observers: [{ userId: otherUserId, user: userSummary(otherUserId) }],
        }),
      );

      await expect(
        service.setObservers('request-1', userId, false, { userIds: [otherUserId] }),
      ).resolves.toBeDefined();
    });

    it('responsável em setor aberto (onlyManagerCanEdit=false) pode definir observadores', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(openSector, technicianRole),
      ]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ sectorId: openSector.id, assignees: [{ userId, user: userSummary(userId) }] }),
      );
      mockPrisma.user.findMany.mockResolvedValue([{ id: otherUserId }]);
      setupTransaction(
        request({
          sectorId: openSector.id,
          assignees: [{ userId, user: userSummary(userId) }],
          observers: [{ userId: otherUserId, user: userSummary(otherUserId) }],
        }),
      );

      await expect(
        service.setObservers('request-1', userId, false, { userIds: [otherUserId] }),
      ).resolves.toBeDefined();
    });

    it('responsável em setor fechado (onlyManagerCanEdit=true) não pode definir observadores', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(baseSector, technicianRole),
      ]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ assignees: [{ userId, user: userSummary(userId) }] }),
      );

      await expect(
        service.setObservers('request-1', userId, false, { userIds: [otherUserId] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('observer sem ser criador ou responsável recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ observers: [{ userId, user: userSummary(userId) }] }),
      );

      await expect(
        service.setObservers('request-1', userId, false, { userIds: [otherUserId] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('request ARCHIVED não pode ter observadores alterados', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(request({ status: RequestStatus.ARCHIVED }));

      await expect(
        service.setObservers('request-1', userId, true, { userIds: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── sendMessage ──────────────────────────────────────────────────────────

  describe('sendMessage - controle de acesso', () => {
    const messageResult = {
      id: 'msg-1',
      content: 'Olá',
      createdAt: new Date(),
      requestId: 'request-1',
      authorId: userId,
      user: userSummary(userId),
    };

    it('manager pode enviar mensagem', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, managerRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(request());
      setupTransaction(messageResult);

      await expect(
        service.sendMessage('request-1', userId, false, 'Olá'),
      ).resolves.toMatchObject({ id: 'msg-1', content: 'Olá' });
      expect(mockPrisma.requestHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'MESSAGE_SENT',
          }),
        }),
      );
    });

    it('technician com canEdit pode enviar mensagem (setor aberto)', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(openSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(request({ sectorId: openSector.id }));
      setupTransaction(messageResult);
      mockPrisma.requestMessage.create.mockResolvedValue(messageResult);

      await expect(
        service.sendMessage('request-1', userId, false, 'Olá'),
      ).resolves.toBeDefined();
    });

    it('technician sem canEdit recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, technicianRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ assignees: [{ userId, user: userSummary(userId) }] }),
      );

      await expect(
        service.sendMessage('request-1', userId, false, 'Olá'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('usuário sem vínculo recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ createdById: otherUserId }),
      );

      await expect(
        service.sendMessage('request-1', userId, false, 'Olá'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── findMessages ─────────────────────────────────────────────────────────

  describe('findMessages - controle de acesso', () => {
    it('quem pode ver o request pode listar mensagens', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([membership(baseSector, managerRole)]);
      mockPrisma.request.findUnique.mockResolvedValue(request());
      mockPrisma.requestMessage.findMany.mockResolvedValue([]);

      await expect(
        service.findMessages('request-1', userId, false),
      ).resolves.toEqual([]);
    });

    it('quem não pode ver o request recebe ForbiddenException', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
      mockPrisma.request.findUnique.mockResolvedValue(
        request({ createdById: otherUserId, assignees: [], observers: [] }),
      );

      await expect(
        service.findMessages('request-1', userId, false),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── findHistory ──────────────────────────────────────────────────────────

  describe('findHistory', () => {
    it('retorna histórico se request existe', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({ id: 'request-1' });
      mockPrisma.requestHistory.findMany.mockResolvedValue([]);

      await expect(service.findHistory('request-1')).resolves.toEqual([]);
    });

    it('lança NotFoundException se request não existe', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(null);

      await expect(service.findHistory('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── permissões por request ───────────────────────────────────────────────

  describe('permissões por request', () => {
    it('usuário sem vínculo não pode ver, editar nem arquivar request de outro usuário', async () => {
      mockPrisma.request.findMany.mockResolvedValue([
        request({ createdById: otherUserId, sectorId: 'external-sector' }),
      ]);

      const result = await service.findMine(userId, false, {});

      expect(result.data[0].permissions).toEqual({
        canView: false,
        canEdit: false,
        canArchive: false,
        canManageObservers: false,
      });
    });

    it('technician em setor fechado não pode editar nem arquivar', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(baseSector, technicianRole),
      ]);
      mockPrisma.request.findMany.mockResolvedValue([
        request({
          sectorId: baseSector.id,
          assignees: [{ userId, user: userSummary(userId) }],
        }),
      ]);

      const result = await service.findAssigned(userId, false, {});

      expect(result.data[0].permissions).toEqual({
        canView: true,
        canEdit: false,
        canArchive: false,
        canManageObservers: false,
      });
    });

    it('technician em setor aberto não opera request atribuído a outro usuário', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(openSector, technicianRole),
      ]);
      mockPrisma.request.findMany.mockResolvedValue([
        request({
          sectorId: openSector.id,
          assignees: [{ userId: otherUserId, user: userSummary(otherUserId) }],
        }),
      ]);

      const result = await service.findAll(userId, false, {});

      expect(result.data[0].permissions).toEqual({
        canView: false,
        canEdit: false,
        canArchive: false,
        canManageObservers: false,
      });
    });

    it('criador sem membership pode ver mas não editar nem arquivar', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
      mockPrisma.request.findMany.mockResolvedValue([
        request({ createdById: userId }),
      ]);

      const result = await service.findMine(userId, false, {});

      expect(result.data[0].permissions).toEqual({
        canView: true,
        canEdit: false,
        canArchive: false,
        canManageObservers: true,
      });
    });

    it('observer sem membership pode ver mas não editar nem arquivar', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([]);
      mockPrisma.request.findMany.mockResolvedValue([
        request({ observers: [{ userId, user: userSummary(userId) }] }),
      ]);

      const result = await service.findAll(userId, false, {});

      expect(result.data[0].permissions).toEqual({
        canView: true,
        canEdit: false,
        canArchive: false,
        canManageObservers: false,
      });
    });
  });

  // ─── findMine e findAssigned ──────────────────────────────────────────────

  describe('findMine e findAssigned', () => {
    it('findMine inclui solicitações criadas ou observadas pelo usuário', async () => {
      await service.findMine(userId, true, { page: 2, limit: 5, status: RequestStatus.NEW });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { createdById: userId },
                  { observers: { some: { userId } } },
                ],
              },
              { status: RequestStatus.NEW },
            ],
          },
          skip: 5,
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('findAssigned sempre filtra por assignees do usuário', async () => {
      await service.findAssigned(userId, false, { sectorId: baseSector.id });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { assignees: { some: { userId } } },
              { sectorId: baseSector.id },
            ],
          },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
