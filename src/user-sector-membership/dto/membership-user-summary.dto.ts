import { ApiProperty } from '@nestjs/swagger';

export class MembershipUserSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  isActive: boolean;
}
