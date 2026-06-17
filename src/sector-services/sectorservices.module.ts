import { Module } from '@nestjs/common';
import { SectorservicesService } from './sectorservices.service';
import { SectorservicesController } from './sectorservices.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SectorsModule } from 'src/sectors/sectors.module';

@Module({
  controllers: [SectorservicesController],
  providers: [SectorservicesService],
  imports: [PrismaModule, SectorsModule],
})
export class SectorservicesModule {}
