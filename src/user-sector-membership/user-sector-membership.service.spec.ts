import { Test, TestingModule } from '@nestjs/testing';
import { UserSectorMembershipService } from './user-sector-membership.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RolesService } from 'src/roles/roles.service';
import { SectorsService } from 'src/sectors/sectors.service';
import { UsersService } from 'src/users/users.service';
import { NotFoundException } from '@nestjs/common';
import { RoleSlug } from '../../generated/prisma/client';

const sectorId = 'sector-uuid-1';

const baseMembership = {
  id: 'membership-uuid-1',
  userId: 'user-uuid-1',
  sectorId,
  roleId: 'role-uuid-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  user: {
    id: 'user-uuid-1',
    firstName: 'João',
    lastName: 'Silva',
    email: 'joao@test.com',
    username: 'joao',
    isActive: true,
  },
  role: {
    id: 'role-uuid-1',
    name: 'Gerente',
    slug: RoleSlug.MANAGER,
  },
};

const mockPrisma = {
  userSectorMembership: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

const mockSectorsService = { findOne: jest.fn() };
const mockRolesService = { findOne: jest.fn() };
const mockUsersService = { findOne: jest.fn() };

describe('UserSectorMembershipService', () => {
  let service: UserSectorMembershipService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSectorMembershipService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SectorsService, useValue: mockSectorsService },
        { provide: RolesService, useValue: mockRolesService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<UserSectorMembershipService>(
      UserSectorMembershipService,
    );
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('deve retornar memberships com user e role', async () => {
      mockSectorsService.findOne.mockResolvedValue({ id: sectorId });
      mockPrisma.userSectorMembership.findMany.mockResolvedValue([
        baseMembership,
      ]);
      mockPrisma.userSectorMembership.count.mockResolvedValue(1);

      const result = await service.findAll(sectorId, { page: 1, limit: 10 });

      expect(result.data[0].user.firstName).toBe('João');
      expect(result.data[0].role.name).toBe('Gerente');
      expect(result.meta.totalPages).toBe(1);
      expect(mockPrisma.userSectorMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sectorId }),
          include: expect.objectContaining({
            user: expect.any(Object),
            role: expect.any(Object),
          }),
        }),
      );
    });

    it('deve lançar NotFoundException se setor não existe', async () => {
      mockSectorsService.findOne.mockRejectedValue(
        new NotFoundException('Setor não encontrado'),
      );

      await expect(service.findAll('invalid', {})).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.userSectorMembership.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('deve retornar membership do setor', async () => {
      mockSectorsService.findOne.mockResolvedValue({ id: sectorId });
      mockPrisma.userSectorMembership.findFirst.mockResolvedValue(
        baseMembership,
      );

      const result = await service.findOne('membership-uuid-1', sectorId);

      expect(result).toEqual(baseMembership);
      expect(mockPrisma.userSectorMembership.findFirst).toHaveBeenCalledWith({
        where: { id: 'membership-uuid-1', sectorId },
        include: expect.any(Object),
      });
    });

    it('deve lançar NotFoundException se membership não pertence ao setor', async () => {
      mockSectorsService.findOne.mockResolvedValue({ id: sectorId });
      mockPrisma.userSectorMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('membership-uuid-1', 'outro-setor'),
      ).rejects.toThrow('Membership não encontrada');
    });
  });

  describe('remove', () => {
    it('deve remover membership existente', async () => {
      mockSectorsService.findOne.mockResolvedValue({ id: sectorId });
      mockPrisma.userSectorMembership.findFirst.mockResolvedValue(
        baseMembership,
      );
      mockPrisma.userSectorMembership.delete.mockResolvedValue(baseMembership);

      await service.remove('membership-uuid-1', sectorId);

      expect(mockPrisma.userSectorMembership.delete).toHaveBeenCalledWith({
        where: { id: 'membership-uuid-1' },
      });
    });
  });
});
