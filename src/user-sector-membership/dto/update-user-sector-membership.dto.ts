import { PartialType } from '@nestjs/swagger';
import { CreateUserSectorMembershipDto } from './create-user-sector-membership.dto';

export class UpdateUserSectorMembershipDto extends PartialType(
  CreateUserSectorMembershipDto,
) {}
