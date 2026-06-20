import { Module } from '@nestjs/common';
import { SectorsService } from './sectors.service';
import { AdminSectorsController } from './admin-sectors.controller';
import { SectorsController } from './sectors.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [SectorsController, AdminSectorsController],
  providers: [SectorsService],
  imports: [PrismaModule],
  exports: [SectorsService],
})
export class SectorsModule {}
