import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PasswordResetService } from './password-reset.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  passwordResetCode: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockMailService = {
  sendPasswordResetCode: jest.fn(),
};

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get(PasswordResetService);
    jest.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.passwordResetCode.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetCode.create.mockResolvedValue({});
    mockPrisma.passwordResetCode.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    mockMailService.sendPasswordResetCode.mockResolvedValue(undefined);
  });

  describe('requestReset', () => {
    it('envia código para o e-mail do usuário encontrado por username', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'joao@email.com',
        firstName: 'João',
        isActive: true,
      });

      const result = await service.requestReset({ username: 'joao' });

      expect(result).toEqual({
        sent: true,
        message: 'Código enviado para o e-mail cadastrado',
      });
      expect(mockMailService.sendPasswordResetCode).toHaveBeenCalledWith(
        'joao@email.com',
        'João',
        expect.stringMatching(/^\d{6}$/),
        5,
      );
    });

    it('lança NotFoundException se usuário não existe', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.requestReset({ email: 'missing@email.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('exige username ou email', async () => {
      await expect(service.requestReset({})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('confirmReset', () => {
    const user = {
      id: 'user-1',
      email: 'joao@email.com',
      firstName: 'João',
      isActive: true,
    };

    it('redefine senha com código válido', async () => {
      const code = '123456';
      const codeHash = await bcrypt.hash(code, 10);

      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue({
        id: 'code-1',
        codeHash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      const result = await service.confirmReset({
        email: 'joao@email.com',
        code,
        password: 'novaSenha',
        passwordConfirmation: 'novaSenha',
      });

      expect(result.message).toBe('Senha redefinida com sucesso');
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('rejeita código inválido', async () => {
      const codeHash = await bcrypt.hash('123456', 10);

      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue({
        id: 'code-1',
        codeHash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      await expect(
        service.confirmReset({
          email: 'joao@email.com',
          code: '000000',
          password: 'novaSenha',
          passwordConfirmation: 'novaSenha',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
