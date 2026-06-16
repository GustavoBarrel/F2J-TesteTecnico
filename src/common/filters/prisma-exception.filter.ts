import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../../../generated/prisma/client';

type PrismaErrorResponseBody = {
  statusCode: HttpStatus;
  error: string;
  message: string;
  fields?: Record<string, string[]>;
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const body = this.getResponseBody(exception);

    response.status(body.statusCode).json(body);
  }

  private getResponseBody(
    exception: Prisma.PrismaClientKnownRequestError,
  ): PrismaErrorResponseBody {
    if (exception.code === 'P2002') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message:
          'Já existe um registro com o mesmo valor para um ou mais campos únicos. Por favor, verifique os campos destacados e escolha valores diferentes.',
        fields: this.getUniqueConstraintFields(exception),
      };
    }

    if (exception.code === 'P2025') {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Registro não encontrado',
      };
    }

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: 'Erro ao processar dados',
    };
  }

  private getUniqueConstraintFields(
    exception: Prisma.PrismaClientKnownRequestError,
  ): Record<string, string[]> {
    const fields = this.extractFields(exception);

    if (fields.length === 0) {
      return {};
    }

    return fields.reduce<Record<string, string[]>>((acc, field) => {
      acc[field] = ['Já está em uso'];
      return acc;
    }, {});
  }

  private extractFields(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string[] {
    const meta = exception.meta;

    // Prisma padrão: meta.target = ['email']
    const target = meta?.target;
    if (Array.isArray(target) && target.length > 0) {
      return target.map(String);
    }
    if (typeof target === 'string') {
      return [target];
    }

    // Prisma com driver adapter (PrismaPg): extrai da constraint name
    // ex: "users_email_key" -> "email"
    const driverError = meta?.driverAdapterError as
      | Record<string, unknown>
      | undefined;
    const cause = driverError?.cause as Record<string, unknown> | undefined;
    const originalMessage = cause?.originalMessage;

    if (typeof originalMessage === 'string') {
      const match = originalMessage.match(/"(\w+)"/);
      if (match) {
        const constraintName = match[1];
        return this.parseConstraintName(constraintName);
      }
    }

    return [];
  }

  private parseConstraintName(constraintName: string): string[] {
    // padrão: "table_field1_field2_key" -> ['field1', 'field2']
    const parts = constraintName.split('_');
    if (parts.length < 3) return [];

    // remove prefixo (nome da tabela) e sufixo ("key")
    const withoutPrefix = parts.slice(1);
    const withoutSuffix = withoutPrefix.slice(0, -1);

    return withoutSuffix;
  }
}
