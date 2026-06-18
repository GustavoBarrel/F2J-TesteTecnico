import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestsModule } from 'src/requests/requests.module';

@Module({
  imports: [PrismaModule, RequestsModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
