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
}
