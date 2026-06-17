import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SectorsModule } from './sectors/sectors.module';
import { SectorservicesModule } from './sector-services/sectorservices.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, SectorsModule, SectorservicesModule],
})
export class AppModule {}
