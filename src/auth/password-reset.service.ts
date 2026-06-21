import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import {
  PasswordResetConfirmResponseDto,
  PasswordResetRequestResponseDto,
} from './dto/password-reset-response.dto';
import {
  PASSWORD_RESET_CODE_EXPIRY_MS,
  PASSWORD_RESET_CODE_LENGTH,
  PASSWORD_RESET_SALT_ROUNDS,
} from './constants/password-reset.constants';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async requestReset(
    dto: RequestPasswordResetDto,
  ): Promise<PasswordResetRequestResponseDto> {
    const identifier = this.resolveIdentifier(dto);
    const user = await this.findUserByIdentifier(identifier);

    if (!user.isActive) {
      throw new BadRequestException('Usuário inativo');
    }

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, PASSWORD_RESET_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_EXPIRY_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetCode.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      await tx.passwordResetCode.create({
        data: {
          userId: user.id,
          codeHash,
          expiresAt,
        },
      });
    });

    await this.mailService.sendPasswordResetCode(
      user.email,
      user.firstName,
      code,
      PASSWORD_RESET_CODE_EXPIRY_MS / 60_000,
    );

    return {
      sent: true,
      message: 'Código enviado para o e-mail cadastrado',
    };
  }

  async confirmReset(
    dto: ConfirmPasswordResetDto,
  ): Promise<PasswordResetConfirmResponseDto> {
    const identifier = this.resolveIdentifier(dto);
    const user = await this.findUserByIdentifier(identifier);

    if (!user.isActive) {
      throw new BadRequestException('Usuário inativo');
    }

    const resetCode = await this.prisma.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetCode) {
      throw new UnauthorizedException('Código inválido ou expirado');
    }

    const isCodeValid = await bcrypt.compare(dto.code, resetCode.codeHash);
    if (!isCodeValid) {
      throw new UnauthorizedException('Código inválido ou expirado');
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      PASSWORD_RESET_SALT_ROUNDS,
    );

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetCode.updateMany({
        where: {
          id: resetCode.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Código inválido ou expirado');
      }

      await tx.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      });

      await tx.passwordResetCode.deleteMany({
        where: { userId: user.id, usedAt: null },
      });
    });

    return { message: 'Senha redefinida com sucesso' };
  }

  private resolveIdentifier(dto: {
    username?: string;
    email?: string;
  }): string {
    const identifier = dto.username?.trim() ?? dto.email?.trim();

    if (!identifier) {
      throw new BadRequestException('Informe username ou e-mail');
    }

    return identifier;
  }

  private async findUserByIdentifier(identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  private generateCode(): string {
    const max = 10 ** PASSWORD_RESET_CODE_LENGTH;
    return randomInt(0, max).toString().padStart(PASSWORD_RESET_CODE_LENGTH, '0');
  }
}
