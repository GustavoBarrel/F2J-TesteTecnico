import { ApiProperty } from '@nestjs/swagger';
import { MembershipUserSummaryDto } from './membership-user-summary.dto';
import { MembershipRoleSummaryDto } from './membership-role-summary.dto';

export class UserSectorMembershipResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  sectorId: string;

  @ApiProperty()
  roleId: string;

  @ApiProperty({ type: MembershipUserSummaryDto })
  user: MembershipUserSummaryDto;

  @ApiProperty({ type: MembershipRoleSummaryDto })
  role: MembershipRoleSummaryDto;
}
