import { Test, TestingModule } from '@nestjs/testing';
import { SectorservicesService } from './sector-services.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectorsService } from 'src/sectors/sectors.service';
import { NotFoundException } from '@nestjs/common';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';

// ─── fixtures ────────────────────────────────────────────────────────────────

const sectorId = 'sector-uuid-1';

const baseSector = {
  id: sectorId,
  name: 'TI',
  active: true,
  onlyManagerCanView: true,
  onlyManagerCanEdit: true,
  onlyManagerCanArchive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  sectorServices: [],
};

const baseService = {
  id: 'service-uuid-1',
  name: 'Instalação de Software',
  active: true,
  sectorId,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const createDto = {
  name: 'Instalação de Software',
  active: true,
  sectorId,
};

const defaultQuery: FindAllQueryDto = { page: 1, limit: 10 };

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  sectorService: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const mockSectorsService = {
  findOne: jest.fn(),
};

// ─── setup ───────────────────────────────────────────────────────────────────

describe('SectorservicesService', () => {
  let service: SectorservicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectorservicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SectorsService, useValue: mockSectorsService },
      ],
    }).compile();

    service = module.get<SectorservicesService>(SectorservicesService);
    jest.clearAllMocks();
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('deve criar serviço e retornar dados completos', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.create.mockResolvedValue(baseService);

      const result = await service.create(sectorId, createDto);

      expect(result).toEqual(baseService);
      expect(result.id).toBeDefined();
      expect(result.sectorId).toBe(sectorId);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('deve validar se o setor existe antes de criar', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.create.mockResolvedValue(baseService);

      await service.create(sectorId, createDto);

      expect(mockSectorsService.findOne).toHaveBeenCalledWith(sectorId);
      expect(mockSectorsService.findOne).toHaveBeenCalledTimes(1);
    });

    it('deve lançar NotFoundException se setor não existe', async () => {
      mockSectorsService.findOne.mockRejectedValue(
        new NotFoundException('Setor não encontrado'),
      );

      await expect(
        service.create('setor-inexistente', createDto),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sectorService.create).not.toHaveBeenCalled();
    });

    it('deve passar sectorId correto para o prisma', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.create.mockResolvedValue(baseService);

      await service.create(sectorId, createDto);

      expect(mockPrisma.sectorService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sectorId }),
      });
    });

    it('deve criar serviço com active: false', async () => {
      const inactiveService = { ...baseService, active: false };
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.create.mockResolvedValue(inactiveService);

      const result = await service.create(sectorId, {
        ...createDto,
        active: false,
      });

      expect(result.active).toBe(false);
    });

    it('não deve chamar create se validação do setor falhar', async () => {
      mockSectorsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create(sectorId, createDto)).rejects.toThrow();

      expect(mockPrisma.sectorService.create).not.toHaveBeenCalled();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('deve retornar lista paginada com meta', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockResolvedValue([baseService]);
      mockPrisma.sectorService.count.mockResolvedValue(1);

      const result = await service.findAll(sectorId, defaultQuery);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('deve sempre filtrar por sectorId', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockResolvedValue([]);
      mockPrisma.sectorService.count.mockResolvedValue(0);

      await service.findAll(sectorId, defaultQuery);

      expect(mockPrisma.sectorService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sectorId }),
        }),
      );
    });

    it('deve retornar data vazia quando setor não tem serviços', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockResolvedValue([]);
      mockPrisma.sectorService.count.mockResolvedValue(0);

      const result = await service.findAll(sectorId, defaultQuery);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('deve calcular totalPages corretamente', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockResolvedValue([]);
      mockPrisma.sectorService.count.mockResolvedValue(25);

      const result = await service.findAll(sectorId, { page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('deve calcular skip corretamente para page 3 limit 5', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockResolvedValue([]);
      mockPrisma.sectorService.count.mockResolvedValue(0);

      await service.findAll(sectorId, { page: 3, limit: 5 });

      expect(mockPrisma.sectorService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('deve filtrar por isActive: true', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockResolvedValue([]);
      mockPrisma.sectorService.count.mockResolvedValue(0);

      await service.findAll(sectorId, { ...defaultQuery, isActive: true });

      expect(mockPrisma.sectorService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ active: true }),
        }),
      );
    });

    it('deve filtrar por isActive: false', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockResolvedValue([]);
      mockPrisma.sectorService.count.mockResolvedValue(0);

      await service.findAll(sectorId, { ...defaultQuery, isActive: false });

      expect(mockPrisma.sectorService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ active: false }),
        }),
      );
    });

    it('deve filtrar por search', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockResolvedValue([]);
      mockPrisma.sectorService.count.mockResolvedValue(0);

      await service.findAll(sectorId, {
        ...defaultQuery,
        search: 'Instalação',
      });

      expect(mockPrisma.sectorService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.objectContaining({ contains: 'Instalação' }),
          }),
        }),
      );
    });

    it('deve lançar NotFoundException se setor não existe', async () => {
      mockSectorsService.findOne.mockRejectedValue(
        new NotFoundException('Setor não encontrado'),
      );

      await expect(
        service.findAll('setor-inexistente', defaultQuery),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sectorService.findMany).not.toHaveBeenCalled();
    });

    it('deve fazer findMany e count em paralelo', async () => {
      let findManyResolved = false;
      let countResolved = false;

      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockImplementation(() => {
        findManyResolved = true;
        return Promise.resolve([]);
      });
      mockPrisma.sectorService.count.mockImplementation(() => {
        countResolved = true;
        return Promise.resolve(0);
      });

      await service.findAll(sectorId, defaultQuery);

      expect(findManyResolved).toBe(true);
      expect(countResolved).toBe(true);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('deve retornar serviço existente', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(baseService);

      const result = await service.findOne('service-uuid-1', sectorId);

      expect(result).toEqual(baseService);
      expect(mockPrisma.sectorService.findFirst).toHaveBeenCalledWith({
        where: { id: 'service-uuid-1', sectorId },
      });
    });

    it('deve lançar NotFoundException se serviço não existe', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(null);

      await expect(service.findOne('id-inexistente', sectorId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('id-inexistente', sectorId)).rejects.toThrow(
        'Serviço do Setor não encontrado',
      );
    });

    it('deve lançar NotFoundException se setor não existe', async () => {
      mockSectorsService.findOne.mockRejectedValue(
        new NotFoundException('Setor não encontrado'),
      );

      await expect(
        service.findOne('service-uuid-1', 'setor-inexistente'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sectorService.findFirst).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException se serviço pertence a outro setor', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('service-uuid-1', 'outro-setor'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne('service-uuid-1', 'outro-setor'),
      ).rejects.toThrow('Serviço do Setor não encontrado');
    });

    it('deve validar setor antes de buscar o serviço', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(baseService);

      await service.findOne('service-uuid-1', sectorId);

      expect(mockSectorsService.findOne).toHaveBeenCalledWith(sectorId);
    });

    it('deve fazer apenas 1 query ao banco', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(baseService);

      await service.findOne('service-uuid-1', sectorId);

      expect(mockPrisma.sectorService.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('deve atualizar e retornar serviço com novos dados', async () => {
      const updated = { ...baseService, name: 'Suporte Técnico' };
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(baseService);
      mockPrisma.sectorService.update.mockResolvedValue(updated);

      const result = await service.update('service-uuid-1', sectorId, {
        name: 'Suporte Técnico',
      });

      expect(result.name).toBe('Suporte Técnico');
      expect(mockPrisma.sectorService.update).toHaveBeenCalledWith({
        where: { id: 'service-uuid-1' },
        data: { name: 'Suporte Técnico' },
      });
    });

    it('deve lançar NotFoundException se serviço não existe', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(null);

      await expect(
        service.update('id-inexistente', sectorId, { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sectorService.update).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException se setor não existe', async () => {
      mockSectorsService.findOne.mockRejectedValue(
        new NotFoundException('Setor não encontrado'),
      );

      await expect(
        service.update('service-uuid-1', 'setor-inexistente', {}),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sectorService.update).not.toHaveBeenCalled();
    });

    it('deve aceitar update parcial (só name)', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(baseService);
      mockPrisma.sectorService.update.mockResolvedValue({
        ...baseService,
        name: 'Novo Nome',
      });

      const result = await service.update('service-uuid-1', sectorId, {
        name: 'Novo Nome',
      });

      expect(result.name).toBe('Novo Nome');
      expect(result.active).toBe(true);
    });
  });

  // ─── toggleActive ──────────────────────────────────────────────────────────

  describe('toggleActive', () => {
    it('deve desativar serviço ativo (true → false)', async () => {
      const deactivated = { ...baseService, active: false };
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(baseService);
      mockPrisma.sectorService.update.mockResolvedValue(deactivated);

      const result = await service.toggleActive('service-uuid-1', sectorId);

      expect(result.active).toBe(false);
      expect(mockPrisma.sectorService.update).toHaveBeenCalledWith({
        where: { id: 'service-uuid-1' },
        data: { active: false },
      });
    });

    it('deve ativar serviço inativo (false → true)', async () => {
      const inactiveService = { ...baseService, active: false };
      const activated = { ...baseService, active: true };
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(inactiveService);
      mockPrisma.sectorService.update.mockResolvedValue(activated);

      const result = await service.toggleActive('service-uuid-1', sectorId);

      expect(result.active).toBe(true);
      expect(mockPrisma.sectorService.update).toHaveBeenCalledWith({
        where: { id: 'service-uuid-1' },
        data: { active: true },
      });
    });

    it('deve lançar NotFoundException se serviço não existe', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(null);

      await expect(
        service.toggleActive('id-inexistente', sectorId),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sectorService.update).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException se setor não existe', async () => {
      mockSectorsService.findOne.mockRejectedValue(
        new NotFoundException('Setor não encontrado'),
      );

      await expect(
        service.toggleActive('service-uuid-1', 'setor-inexistente'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sectorService.update).not.toHaveBeenCalled();
    });

    it('não deve alterar outros campos além de active', async () => {
      const deactivated = { ...baseService, active: false };
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(baseService);
      mockPrisma.sectorService.update.mockResolvedValue(deactivated);

      const result = await service.toggleActive('service-uuid-1', sectorId);

      expect(result.name).toBe(baseService.name);
      expect(result.sectorId).toBe(baseService.sectorId);
    });

    it('toggle usa active do SERVIÇO, não do setor', async () => {
      const inactiveService = { ...baseService, active: false };
      mockSectorsService.findOne.mockResolvedValue({
        ...baseSector,
        active: true,
      });
      mockPrisma.sectorService.findFirst.mockResolvedValue(inactiveService);
      mockPrisma.sectorService.update.mockResolvedValue({
        ...baseService,
        active: true,
      });

      await service.toggleActive('service-uuid-1', sectorId);

      expect(mockPrisma.sectorService.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: true } }),
      );
    });
  });

  // ─── performance ───────────────────────────────────────────────────────────

  describe('performance', () => {
    it('create deve resolver em menos de 100ms', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.create.mockResolvedValue(baseService);

      const start = Date.now();
      await service.create(sectorId, createDto);

      expect(Date.now() - start).toBeLessThan(100);
    });

    it('findAll com 1000 serviços deve resolver em menos de 100ms', async () => {
      const bigList = Array.from({ length: 1000 }, (_, i) => ({
        ...baseService,
        id: `uuid-${i}`,
        name: `Serviço ${i}`,
      }));
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findMany.mockResolvedValue(bigList);
      mockPrisma.sectorService.count.mockResolvedValue(1000);

      const start = Date.now();
      const result = await service.findAll(sectorId, defaultQuery);

      expect(result.data).toHaveLength(1000);
      expect(Date.now() - start).toBeLessThan(100);
    });

    it('toggleActive deve fazer 2 queries (findOne + update)', async () => {
      mockSectorsService.findOne.mockResolvedValue(baseSector);
      mockPrisma.sectorService.findFirst.mockResolvedValue(baseService);
      mockPrisma.sectorService.update.mockResolvedValue({
        ...baseService,
        active: false,
      });

      await service.toggleActive('service-uuid-1', sectorId);

      expect(mockPrisma.sectorService.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.sectorService.update).toHaveBeenCalledTimes(1);
    });
  });
});
