import { Module } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequestsAutoCompleteJob } from './requests-auto-complete.job';
import { RequestAutoCompleteSettingsService } from './request-auto-complete-settings.service';
import { RequestAutoCompleteSettingsController } from './request-auto-complete-settings.controller';
import { RequestsController } from './requests.controller';
import { SectorRequestsController } from './sector-requests.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SectorsModule } from 'src/sectors/sectors.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [
    RequestsController,
    SectorRequestsController,
    RequestAutoCompleteSettingsController,
  ],
  providers: [
    RequestsService,
    RequestsAutoCompleteJob,
    RequestAutoCompleteSettingsService,
  ],
  imports: [PrismaModule, SectorsModule, UsersModule],
  exports: [RequestsService],
})
export class RequestsModule {}
