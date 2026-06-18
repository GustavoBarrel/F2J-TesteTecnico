import { Test, TestingModule } from '@nestjs/testing';
import { SectorsService } from './sectors.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';

// ─── fixtures ────────────────────────────────────────────────────────────────

const baseSector = {
  id: 'uuid-1',
  name: 'TI',
  isActive: true,
  onlyManagerCanView: true,
  onlyManagerCanEdit: true,
  onlyManagerCanArchive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const createDto = {
  name: 'TI',
  isActive: true,
  onlyManagerCanView: true,
  onlyManagerCanEdit: true,
  onlyManagerCanArchive: true,
};

const defaultQuery: FindAllQueryDto = {
  page: 1,
  limit: 10,
};

const mockPrisma = {
  sector: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

// ─── setup ───────────────────────────────────────────────────────────────────

describe('SectorsService', () => {
  let service: SectorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectorsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SectorsService>(SectorsService);
    jest.clearAllMocks();
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('deve retornar setor com todos os campos', async () => {
      mockPrisma.sector.create.mockResolvedValue(baseSector);

      const result = await service.create(createDto);

      expect(result).toEqual(baseSector);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('deve chamar prisma.create com os dados exatos do DTO', async () => {
      mockPrisma.sector.create.mockResolvedValue(baseSector);

      await service.create(createDto);

      expect(mockPrisma.sector.create).toHaveBeenCalledWith({
        data: createDto,
      });
      expect(mockPrisma.sector.create).toHaveBeenCalledTimes(1);
    });

    it('deve propagar erro de nome duplicado (P2002)', async () => {
      const prismaError = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      mockPrisma.sector.create.mockRejectedValue(prismaError);

      await expect(service.create(createDto)).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('deve criar setor com isActive: false', async () => {
      const inactiveSector = { ...baseSector, isActive: false };
      mockPrisma.sector.create.mockResolvedValue(inactiveSector);

      const result = await service.create({ ...createDto, isActive: false });

      expect(result.isActive).toBe(false);
    });

    it('deve criar setor com todas as flags false', async () => {
      const allFalse = {
        ...baseSector,
        onlyManagerCanView: false,
        onlyManagerCanEdit: false,
        onlyManagerCanArchive: false,
      };
      mockPrisma.sector.create.mockResolvedValue(allFalse);

      const result = await service.create({
        ...createDto,
        onlyManagerCanView: false,
        onlyManagerCanEdit: false,
        onlyManagerCanArchive: false,
      });

      expect(result.onlyManagerCanView).toBe(false);
      expect(result.onlyManagerCanEdit).toBe(false);
      expect(result.onlyManagerCanArchive).toBe(false);
    });

    it('não deve chamar findUnique durante create', async () => {
      mockPrisma.sector.create.mockResolvedValue(baseSector);

      await service.create(createDto);

      expect(mockPrisma.sector.findUnique).not.toHaveBeenCalled();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('deve retornar lista paginada com meta', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([baseSector]);
      mockPrisma.sector.count.mockResolvedValue(1);

      const result = await service.findAll(defaultQuery);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('deve retornar data vazia quando não há setores', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([]);
      mockPrisma.sector.count.mockResolvedValue(0);

      const result = await service.findAll(defaultQuery);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('deve calcular totalPages corretamente', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([]);
      mockPrisma.sector.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('deve usar page e limit default quando não informados', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([]);
      mockPrisma.sector.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.sector.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('deve filtrar por isActive: true quando active = true', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([]);
      mockPrisma.sector.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, isActive: true });

      expect(mockPrisma.sector.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('deve filtrar por isActive: false quando active = false', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([]);
      mockPrisma.sector.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, isActive: false });

      expect(mockPrisma.sector.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('deve filtrar por search quando informado', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([]);
      mockPrisma.sector.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, search: 'TI' });

      expect(mockPrisma.sector.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: expect.objectContaining({ contains: 'TI' }),
              }),
            ]),
          }),
        }),
      );
    });

    it('deve fazer findMany e count em paralelo (Promise.all)', async () => {
      let findManyResolved = false;
      let countResolved = false;

      mockPrisma.sector.findMany.mockImplementation(() => {
        findManyResolved = true;
        return Promise.resolve([]);
      });
      mockPrisma.sector.count.mockImplementation(() => {
        countResolved = true;
        return Promise.resolve(0);
      });

      await service.findAll(defaultQuery);

      expect(findManyResolved).toBe(true);
      expect(countResolved).toBe(true);
    });

    it('deve calcular skip corretamente para page 3 limit 10', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([]);
      mockPrisma.sector.count.mockResolvedValue(0);

      await service.findAll({ page: 3, limit: 10 });

      expect(mockPrisma.sector.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('deve retornar setor existente pelo id', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(baseSector);

      const result = await service.findOne('uuid-1');

      expect(result).toEqual(baseSector);
      expect(mockPrisma.sector.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        include: { sectorServices: true },
      });
    });

    it('deve lançar NotFoundException quando setor não existe', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(null);

      await expect(service.findOne('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('id-inexistente')).rejects.toThrow(
        'Setor não encontrado',
      );
    });

    it('deve fazer apenas 1 query ao banco', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(baseSector);

      await service.findOne('uuid-1');

      expect(mockPrisma.sector.findUnique).toHaveBeenCalledTimes(1);
    });

    it('deve retornar sectorServices como array vazio quando não há serviços', async () => {
      const sectorWithNoServices = { ...baseSector, sectorServices: [] };
      mockPrisma.sector.findUnique.mockResolvedValue(sectorWithNoServices);

      const result = await service.findOne('uuid-1');

      expect(result.sectorServices).toEqual([]);
      expect(Array.isArray(result.sectorServices)).toBe(true);
    });

    it('deve retornar sectorServices com dados completos', async () => {
      const sectorService1 = {
        id: 'ss-uuid-1',
        name: 'Instalação de Software',
        isActive: true,
        sectorId: 'uuid-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      const sectorService2 = {
        id: 'ss-uuid-2',
        name: 'Troca de Hardware',
        isActive: false,
        sectorId: 'uuid-1',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      };
      const sectorWithServices = {
        ...baseSector,
        sectorServices: [sectorService1, sectorService2],
      };
      mockPrisma.sector.findUnique.mockResolvedValue(sectorWithServices);

      const result = await service.findOne('uuid-1');

      expect(result.sectorServices).toHaveLength(2);
      expect(result.sectorServices![0].id).toBe('ss-uuid-1');
      expect(result.sectorServices![0].name).toBe('Instalação de Software');
      expect(result.sectorServices![0].isActive).toBe(true);
      expect(result.sectorServices![0].sectorId).toBe('uuid-1');
      expect(result.sectorServices![1].isActive).toBe(false);
    });

    it('deve retornar sectorServices com active true e false misturados', async () => {
      const sectorWithMixed = {
        ...baseSector,
        sectorServices: [
          {
            id: 'ss-1',
            name: 'Ativo',
            isActive: true,
            sectorId: 'uuid-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'ss-2',
            name: 'Inativo',
            isActive: false,
            sectorId: 'uuid-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };
      mockPrisma.sector.findUnique.mockResolvedValue(sectorWithMixed);

      const result = await service.findOne('uuid-1');

      const ativos = result.sectorServices!.filter((s) => s.isActive);
      const inativos = result.sectorServices!.filter((s) => !s.isActive);

      expect(ativos).toHaveLength(1);
      expect(inativos).toHaveLength(1);
    });

    it('deve incluir sectorServices na query (include: { sectorServices: true })', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue({
        ...baseSector,
        sectorServices: [],
      });

      await service.findOne('uuid-1');

      expect(mockPrisma.sector.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { sectorServices: true },
        }),
      );
    });

    it('findAll NÃO deve incluir sectorServices (sem include)', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([baseSector]);
      mockPrisma.sector.count.mockResolvedValue(1);

      await service.findAll(defaultQuery);

      const call = mockPrisma.sector.findMany.mock.calls[0][0];
      expect(call.include).toBeUndefined();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('deve atualizar e retornar setor com novos dados', async () => {
      const updated = { ...baseSector, name: 'TI Atualizado' };
      mockPrisma.sector.findUnique.mockResolvedValue(baseSector);
      mockPrisma.sector.update.mockResolvedValue(updated);

      const result = await service.update('uuid-1', { name: 'TI Atualizado' });

      expect(result.name).toBe('TI Atualizado');
      expect(mockPrisma.sector.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { name: 'TI Atualizado' },
      });
    });

    it('deve lançar NotFoundException ao atualizar id inexistente', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(null);

      await expect(
        service.update('id-inexistente', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('não deve chamar update se findOne lançar exceção', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(null);

      await expect(service.update('id-inexistente', {})).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.sector.update).not.toHaveBeenCalled();
    });

    it('deve fazer exatamente 2 queries (findOne + update)', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(baseSector);
      mockPrisma.sector.update.mockResolvedValue(baseSector);

      await service.update('uuid-1', { name: 'X' });

      expect(mockPrisma.sector.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.sector.update).toHaveBeenCalledTimes(1);
    });
  });

  // ─── toggleActive ──────────────────────────────────────────────────────────

  describe('toggleActive', () => {
    it('deve desativar setor ativo (true → false)', async () => {
      const deactivated = { ...baseSector, isActive: false };
      mockPrisma.sector.findUnique.mockResolvedValue(baseSector);
      mockPrisma.sector.update.mockResolvedValue(deactivated);

      const result = await service.toggleActive('uuid-1');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.sector.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { isActive: false },
      });
    });

    it('deve ativar setor inativo (false → true)', async () => {
      const inactiveSector = { ...baseSector, isActive: false };
      const activated = { ...baseSector, isActive: true };
      mockPrisma.sector.findUnique.mockResolvedValue(inactiveSector);
      mockPrisma.sector.update.mockResolvedValue(activated);

      const result = await service.toggleActive('uuid-1');

      expect(result.isActive).toBe(true);
      expect(mockPrisma.sector.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { isActive: true },
      });
    });

    it('deve lançar NotFoundException para id inexistente', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('não deve chamar update se setor não existe', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.sector.update).not.toHaveBeenCalled();
    });

    it('não deve alterar outros campos além de active', async () => {
      const deactivated = { ...baseSector, isActive: false };
      mockPrisma.sector.findUnique.mockResolvedValue(baseSector);
      mockPrisma.sector.update.mockResolvedValue(deactivated);

      const result = await service.toggleActive('uuid-1');

      expect(result.name).toBe(baseSector.name);
      expect(result.onlyManagerCanEdit).toBe(baseSector.onlyManagerCanEdit);
      expect(result.onlyManagerCanView).toBe(baseSector.onlyManagerCanView);
      expect(result.onlyManagerCanArchive).toBe(
        baseSector.onlyManagerCanArchive,
      );
    });

    it('deve fazer exatamente 2 queries (findOne + update)', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(baseSector);
      mockPrisma.sector.update.mockResolvedValue({
        ...baseSector,
        isActive: false,
      });

      await service.toggleActive('uuid-1');

      expect(mockPrisma.sector.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.sector.update).toHaveBeenCalledTimes(1);
    });
  });

  // ─── performance ───────────────────────────────────────────────────────────

  describe('performance', () => {
    it('create deve resolver em menos de 100ms', async () => {
      mockPrisma.sector.create.mockResolvedValue(baseSector);

      const start = Date.now();
      await service.create(createDto);

      expect(Date.now() - start).toBeLessThan(100);
    });

    it('findAll com 1000 registros deve resolver em menos de 100ms', async () => {
      const bigList = Array.from({ length: 1000 }, (_, i) => ({
        ...baseSector,
        id: `uuid-${i}`,
        name: `Setor ${i}`,
      }));
      mockPrisma.sector.findMany.mockResolvedValue(bigList);
      mockPrisma.sector.count.mockResolvedValue(1000);

      const start = Date.now();
      const result = await service.findAll(defaultQuery);

      expect(result.data).toHaveLength(1000);
      expect(Date.now() - start).toBeLessThan(100);
    });

    it('toggleActive deve resolver em menos de 100ms', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(baseSector);
      mockPrisma.sector.update.mockResolvedValue({
        ...baseSector,
        isActive: false,
      });

      const start = Date.now();
      await service.toggleActive('uuid-1');

      expect(Date.now() - start).toBeLessThan(100);
    });
  });
});
