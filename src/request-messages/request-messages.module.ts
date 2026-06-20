import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestMessagesService } from './request-messages.service';

@Module({
  imports: [PrismaModule],
  providers: [RequestMessagesService],
  exports: [RequestMessagesService],
})
export class RequestMessagesModule {}
