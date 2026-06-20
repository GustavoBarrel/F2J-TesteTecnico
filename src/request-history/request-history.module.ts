import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestHistoryService } from './request-history.service';

@Module({
  imports: [PrismaModule],
  providers: [RequestHistoryService],
  exports: [RequestHistoryService],
})
export class RequestHistoryModule {}
