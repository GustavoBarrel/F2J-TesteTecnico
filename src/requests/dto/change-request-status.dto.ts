import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { RequestStatus } from '../../../generated/prisma/client';

const ALLOWED_STATUSES = [
  RequestStatus.PENDING,
  RequestStatus.IN_PROGRESS,
  RequestStatus.COMPLETED,
] as const;

export type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export class ChangeRequestStatusDto {
  @IsNotEmpty()
  @IsEnum(ALLOWED_STATUSES, {
    message: `status deve ser um dos valores: ${ALLOWED_STATUSES.join(', ')}`,
  })
  @ApiProperty({
    enum: ALLOWED_STATUSES,
    description: 'Novo status da solicitação',
  })
  status: AllowedStatus;
}
