import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { RequestStatus } from '../../../generated/prisma/client';

const ALLOWED_STATUSES = [
  RequestStatus.PENDING,
  RequestStatus.IN_PROGRESS,
  RequestStatus.SOLVED,
] as const;

export type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export class ChangeRequestStatusDto {
  @IsNotEmpty()
  @IsEnum(ALLOWED_STATUSES, {
    message: `status deve ser um dos valores: ${ALLOWED_STATUSES.join(', ')}`,
  })
  @ApiProperty({
    enum: ALLOWED_STATUSES,
    description:
      'Novo status. Valores aceitos: PENDING, IN_PROGRESS, SOLVED. COMPLETED só via PATCH /requests/:id/solution-review. Admin global pode usar este endpoint em chamados bloqueados (ex. reabrir COMPLETED).',
  })
  status: AllowedStatus;
}
