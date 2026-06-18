import { ApiProperty } from '@nestjs/swagger';

export class RequestPermissionsDto {
  @ApiProperty()
  canView: boolean;

  @ApiProperty()
  canEdit: boolean;

  @ApiProperty()
  canArchive: boolean;
}
