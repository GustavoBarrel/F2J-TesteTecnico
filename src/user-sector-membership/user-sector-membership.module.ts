import { Module } from '@nestjs/common';
import { UserSectorMembershipService } from './user-sector-membership.service';
import { UserSectorMembershipController } from './user-sector-membership.controller';
import { SectorsModule } from 'src/sectors/sectors.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsersModule } from 'src/users/users.module';
import { RolesModule } from 'src/roles/roles.module';

@Module({
  controllers: [UserSectorMembershipController],
  providers: [UserSectorMembershipService],
  imports: [SectorsModule, PrismaModule, RolesModule, UsersModule],
  exports: [UserSectorMembershipService],
})
export class UserSectorMembershipModule {}
