import { ApiProperty } from '@nestjs/swagger';

export class RequestPermissionsDto {
  @ApiProperty()
  canView: boolean;

  @ApiProperty()
  canEdit: boolean;

  @ApiProperty()
  canArchive: boolean;

  @ApiProperty({
    description:
      'Pode gerenciar observadores: criador, gerente, admin, ou técnico responsável quando onlyManagerCanEdit=false',
  })
  canManageObservers: boolean;
}
