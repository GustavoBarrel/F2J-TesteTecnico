import { ApiProperty } from '@nestjs/swagger';
import { RoleSlug } from '../../../generated/prisma/client';

export class SectorMemberRoleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: RoleSlug })
  slug: RoleSlug;
}

export class SectorMemberOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: SectorMemberRoleDto })
  role: SectorMemberRoleDto;
}
