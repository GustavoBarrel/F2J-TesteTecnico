import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SectorsModule } from './sectors/sectors.module';
import { SectorservicesModule } from './sector-services/sector-services.module';
import { UserSectorMembershipModule } from './user-sector-membership/user-sector-membership.module';
import { RolesModule } from './roles/roles.module';
import { RequestsModule } from './requests/requests.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    SectorsModule,
    SectorservicesModule,
    UserSectorMembershipModule,
    RolesModule,
    RequestsModule,
    MeModule,
  ],
})
export class AppModule {}
