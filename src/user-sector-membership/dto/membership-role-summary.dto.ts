import { ApiProperty } from '@nestjs/swagger';
import { RoleSlug } from '../../../generated/prisma/client';

export class MembershipRoleSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: RoleSlug })
  slug: RoleSlug;
}
