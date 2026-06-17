import { Module } from '@nestjs/common';
import { SectorservicesService } from './sector-services.service';
import { SectorservicesController } from './sector-services.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SectorsModule } from 'src/sectors/sectors.module';

@Module({
  controllers: [SectorservicesController],
  providers: [SectorservicesService],
  imports: [PrismaModule, SectorsModule],
})
export class SectorservicesModule {}
