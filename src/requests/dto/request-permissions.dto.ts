import { ApiProperty } from '@nestjs/swagger';

export class RequestPermissionsDto {
  @ApiProperty()
  canView: boolean;

  @ApiProperty()
  canEdit: boolean;

  @ApiProperty({
    description:
      'Pode enviar mensagens: criador, gerente, admin ou responsável atribuído',
  })
  canMessage: boolean;

  @ApiProperty()
  canArchive: boolean;

  @ApiProperty({
    description:
      'Pode gerenciar observadores: criador, gerente, admin ou responsável atribuído',
  })
  canManageObservers: boolean;

  @ApiProperty({
    description:
      'Pode alterar status via PATCH /requests/:id/status: admin global (inclusive em status bloqueados, ex. reabrir COMPLETED), usuário com canEdit, ou responsável atribuído em setor com onlyManagerCanEdit (enquanto o chamado não estiver bloqueado).',
  })
  canChangeStatus: boolean;

  @ApiProperty({
    description:
      'Pode aprovar ou rejeitar a solução quando o chamado está com status SOLVED. Disponível para o requerente (criador) ou admin global.',
  })
  canReviewSolution: boolean;
}
