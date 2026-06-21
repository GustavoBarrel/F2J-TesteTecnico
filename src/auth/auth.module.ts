import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    UsersModule,
    MailModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '9h' },
      }),
    }),
    PrismaModule,
  ],
  providers: [
    AuthService,
    PasswordResetService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
