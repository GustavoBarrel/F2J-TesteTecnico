import { Body, Controller, Post, Get, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SignInDto } from './dto/sign-in.dto';
import { SignInResponseDto } from './dto/sign-in-response.dto';
import { Request as ExpressRequest } from 'express';

type AuthenticatedRequest = ExpressRequest & {
  user: Record<string, unknown>;
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
