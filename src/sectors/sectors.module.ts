import { Module } from '@nestjs/common';
import { SectorsService } from './sectors.service';
import { SectorsController } from './sectors.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [SectorsController],
  providers: [SectorsService],
  imports: [PrismaModule],
  exports: [SectorsService],
})
export class SectorsModule {}
