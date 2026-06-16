import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async signIn(
    username: string,
    password: string,
  ): Promise<{ access_token: string }> {
    const user = await this.usersService.findByUsername(username);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }
    const teste = await this.prisma.user.findUnique({
      where: {
        id: user.id,
      },
    });
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      isGlobalAdmin: user.isGlobalAdmin,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
