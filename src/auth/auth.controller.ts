import { Body, Controller, Post, Get, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { Public } from './decorators/public.decorator';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SignInDto } from './dto/sign-in.dto';
import { SignInResponseDto } from './dto/sign-in-response.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import {
  PasswordResetConfirmResponseDto,
  PasswordResetRequestResponseDto,
} from './dto/password-reset-response.dto';
import { Request as ExpressRequest } from 'express';

type AuthenticatedRequest = ExpressRequest & {
  user: Record<string, unknown>;
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Login',
    description: 'Autentica o usuário e retorna o token JWT.',
  })
  @ApiOkResponse({ type: SignInResponseDto })
  @ApiUnauthorizedResponse({ description: 'Usuário ou senha inválidos' })
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto.username, signInDto.password);
  }

  @Public()
  @Post('request-password-reset')
  @ApiOperation({
    summary: 'Solicitar código de redefinição de senha',
    description:
      'Informe `username` ou `email`. Se for username, o código é enviado ao e-mail cadastrado. Válido por 5 minutos.',
  })
  @ApiOkResponse({ type: PasswordResetRequestResponseDto })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiBadRequestResponse({
    description: 'Usuário inativo ou identificador ausente',
  })
  @ApiServiceUnavailableResponse({ description: 'Falha ao enviar e-mail' })
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<PasswordResetRequestResponseDto> {
    return this.passwordResetService.requestReset(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({
    summary: 'Redefinir senha com código',
    description:
      'Informe o mesmo `username` ou `email` da solicitação, o código de 6 dígitos, a nova senha e a confirmação. O código é de uso único e expira em 5 minutos.',
  })
  @ApiOkResponse({ type: PasswordResetConfirmResponseDto })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Código inválido ou expirado' })
  @ApiBadRequestResponse({
    description: 'Dados inválidos ou usuário inativo',
  })
  resetPassword(
    @Body() dto: ConfirmPasswordResetDto,
  ): Promise<PasswordResetConfirmResponseDto> {
    return this.passwordResetService.confirmReset(dto);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perfil',
    description:
      'Retorna os dados do usuário autenticado extraídos do token JWT.',
  })
  @ApiOkResponse({ description: 'Dados do token JWT do usuário autenticado' })
  @ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
  getProfile(@Request() req: AuthenticatedRequest): Record<string, unknown> {
    return req.user;
  }
}
