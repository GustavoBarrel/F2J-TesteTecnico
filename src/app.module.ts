import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SectorsModule } from './sectors/sectors.module';
import { SectorservicesModule } from './sector-services/sector-services.module';
import { UserSectorMembershipModule } from './user-sector-membership/user-sector-membership.module';
import { RolesModule } from './roles/roles.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    SectorsModule,
    SectorservicesModule,
    UserSectorMembershipModule,
    RolesModule,
  ],
})
export class AppModule {}
