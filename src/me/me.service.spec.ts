import { Test, TestingModule } from '@nestjs/testing';
import { MeService } from './me.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestsService } from 'src/requests/requests.service';
import { RequestStatus, Role, RoleSlug } from '../../generated/prisma/client';

const userId = 'user-1';

const tiSector = {
  id: 'sector-ti',
  name: 'TI',
  isActive: true,
  onlyManagerCanView: true,
  onlyManagerCanEdit: true,
  onlyManagerCanArchive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const rhSector = {
  ...tiSector,
  id: 'sector-rh',
  name: 'RH',
  onlyManagerCanView: false,
  onlyManagerCanEdit: false,
  onlyManagerCanArchive: false,
};

const inactiveSector = {
  ...tiSector,
  id: 'sector-inactive',
  name: 'Inativo',
  isActive: false,
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

const membership = (sector: typeof tiSector, role: Role = technicianRole) => ({
  id: `membership-${sector.id}`,
  userId,
  sectorId: sector.id,
  roleId: role.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  role,
  sector,
});

const statusCount = (status: RequestStatus, count: number) => ({
  status,
  _count: { _all: count },
});

const mockPrisma = {
  sector: {
    findMany: jest.fn(),
  },
  userSectorMembership: {
    findMany: jest.fn(),
  },
  request: {
    groupBy: jest.fn(),
  },
};

const mockRequestsService = {
  findMine: jest.fn(),
  findAssigned: jest.fn(),
};

describe('MeService', () => {
  let service: MeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RequestsService, useValue: mockRequestsService },
      ],
    }).compile();

    service = module.get(MeService);
    jest.clearAllMocks();
  });

  describe('getMySectors', () => {
    it('admin global vê todos os setores ativos e role null', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([tiSector, rhSector]);
      mockPrisma.request.groupBy
        .mockResolvedValueOnce([
          statusCount(RequestStatus.NEW, 3),
          statusCount(RequestStatus.IN_PROGRESS, 1),
        ])
        .mockResolvedValueOnce([statusCount(RequestStatus.COMPLETED, 2)]);

      const result = await service.getMySectors(userId, true, {});

      expect(mockPrisma.sector.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      expect(mockPrisma.userSectorMembership.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.request.groupBy).toHaveBeenNthCalledWith(1, {
        by: ['status'],
        where: { sectorId: tiSector.id },
        _count: { _all: true },
      });
      expect(result).toEqual([
        {
          id: tiSector.id,
          name: tiSector.name,
          role: null,
          onlyManagerCanView: true,
          onlyManagerCanEdit: true,
          onlyManagerCanArchive: true,
          statusCounts: [
            { status: RequestStatus.NEW, count: 3 },
            { status: RequestStatus.IN_PROGRESS, count: 1 },
          ],
        },
        {
          id: rhSector.id,
          name: rhSector.name,
          role: null,
          onlyManagerCanView: false,
          onlyManagerCanEdit: false,
          onlyManagerCanArchive: false,
          statusCounts: [{ status: RequestStatus.COMPLETED, count: 2 }],
        },
      ]);
    });

    it('admin global aplica filtros search e isActive', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([inactiveSector]);
      mockPrisma.request.groupBy.mockResolvedValue([]);

      await service.getMySectors(userId, true, {
        search: 'Ina',
        isActive: false,
      });

      expect(mockPrisma.sector.findMany).toHaveBeenCalledWith({
        where: {
          isActive: false,
          name: { contains: 'Ina', mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
      });
    });

    it('manager vê contagem de todos os chamados do setor', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(tiSector, managerRole),
      ]);
      mockPrisma.request.groupBy.mockResolvedValue([
        statusCount(RequestStatus.NEW, 5),
      ]);

      const result = await service.getMySectors(userId, false, {});

      expect(mockPrisma.request.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: { sectorId: tiSector.id },
        _count: { _all: true },
      });
      expect(result[0].role).toBe(RoleSlug.MANAGER);
      expect(result[0].statusCounts).toEqual([
        { status: RequestStatus.NEW, count: 5 },
      ]);
    });

    it('technician vê fila, atribuídos, criados e observados quando onlyManagerCanView é false', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(rhSector, technicianRole),
      ]);
      mockPrisma.request.groupBy.mockResolvedValue([
        statusCount(RequestStatus.PENDING, 4),
      ]);

      await service.getMySectors(userId, false, {});

      expect(mockPrisma.request.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: {
          OR: [
            { sectorId: rhSector.id, assignees: { none: {} } },
            { sectorId: rhSector.id, assignees: { some: { userId } } },
            { sectorId: rhSector.id, createdById: userId },
            { sectorId: rhSector.id, observers: { some: { userId } } },
          ],
        },
        _count: { _all: true },
      });
    });

    it('technician vê atribuídos, criados e observados quando onlyManagerCanView é true', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(tiSector, technicianRole),
      ]);
      mockPrisma.request.groupBy.mockResolvedValue([
        statusCount(RequestStatus.IN_PROGRESS, 2),
      ]);

      await service.getMySectors(userId, false, {});

      expect(mockPrisma.request.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: {
          OR: [
            { sectorId: tiSector.id, assignees: { some: { userId } } },
            { sectorId: tiSector.id, createdById: userId },
            { sectorId: tiSector.id, observers: { some: { userId } } },
          ],
        },
        _count: { _all: true },
      });
    });

    it('usuário comum aplica filtro padrão isActive=true e filtro search', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(tiSector, managerRole),
        membership(inactiveSector, managerRole),
        membership(rhSector, technicianRole),
      ]);
      mockPrisma.request.groupBy.mockResolvedValue([]);

      const result = await service.getMySectors(userId, false, {
        search: 't',
      });

      expect(result.map((sector) => sector.id)).toEqual([tiSector.id]);
      expect(mockPrisma.request.groupBy).toHaveBeenCalledTimes(1);
    });

    it('usuário comum pode consultar setores inativos com isActive=false', async () => {
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        membership(tiSector, managerRole),
        membership(inactiveSector, managerRole),
      ]);
      mockPrisma.request.groupBy.mockResolvedValue([]);

      const result = await service.getMySectors(userId, false, {
        isActive: false,
      });

      expect(result.map((sector) => sector.id)).toEqual([inactiveSector.id]);
    });
  });

  describe('requests pessoais', () => {
    it('findMyRequests delega para RequestsService.findMine', async () => {
      const query = { page: 2, limit: 5, status: RequestStatus.NEW };
      const response = { data: [], meta: { page: 2, limit: 5, total: 0, totalPages: 0 } };
      mockRequestsService.findMine.mockResolvedValue(response);

      await expect(service.findMyRequests(userId, false, query)).resolves.toBe(
        response,
      );
      expect(mockRequestsService.findMine).toHaveBeenCalledWith(
        userId,
        false,
        query,
      );
    });

    it('findAssignedRequests delega para RequestsService.findAssigned', async () => {
      const query = { page: 1, limit: 10, sectorId: tiSector.id };
      const response = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockRequestsService.findAssigned.mockResolvedValue(response);

      await expect(
        service.findAssignedRequests(userId, true, query),
      ).resolves.toBe(response);
      expect(mockRequestsService.findAssigned).toHaveBeenCalledWith(
        userId,
        true,
        query,
      );
    });
  });
});
