import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { formatValidationErrors } from './common/utils/format-validation-errors';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          error: 'Validation Error',
          message: 'Dados inválidos',
          fields: formatValidationErrors(errors),
        }),
    }),
  );

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Central de Serviços API')
    .setDescription(
      'API da Central de Serviços.\n\n' +
        '## Autenticação\n' +
        'Use `POST /api/auth/login` para obter o `access_token` e clique em **Authorize** para autenticar.\n\n' +
        '## Tags\n' +
        '- **Auth** — Login e perfil do usuário autenticado\n' +
        '- **Admin: Usuários** — CRUD de usuários (requer `isGlobalAdmin`)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
