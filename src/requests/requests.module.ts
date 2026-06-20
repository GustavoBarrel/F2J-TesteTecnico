import { Module } from '@nestjs/common';
import { RequestsService } from './services/requests.service';
import { RequestActionsService } from './services/request-actions.service';
import { RequestHistoryModule } from 'src/request-history/request-history.module';
import { RequestMessagesModule } from 'src/request-messages/request-messages.module';
import { RequestMessagesAccessService } from './services/request-messages-access.service';
import { RequestPermissionsService } from './services/request-permissions.service';
import { RequestAutoCompleteSettingsController } from './schedules/auto-complete/request-auto-complete-settings.controller';
import { RequestAutoCompleteService } from './schedules/auto-complete/request-auto-complete.service';
import { RequestAutoCompleteSettingsService } from './schedules/auto-complete/request-auto-complete-settings.service';
import { RequestsAutoCompleteJob } from './schedules/auto-complete/requests-auto-complete.job';
import { AdminRequestsController } from './controllers/admin-requests.controller';
import { RequestsController } from './controllers/requests.controller';
import { SectorRequestsController } from './controllers/sector-requests.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SectorsModule } from 'src/sectors/sectors.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [
    RequestsController,
    AdminRequestsController,
    SectorRequestsController,
    RequestAutoCompleteSettingsController,
  ],
  providers: [
    RequestsService,
    RequestPermissionsService,
    RequestMessagesAccessService,
    RequestActionsService,
    RequestAutoCompleteService,
    RequestsAutoCompleteJob,
    RequestAutoCompleteSettingsService,
  ],
  imports: [
    PrismaModule,
    SectorsModule,
    UsersModule,
    RequestHistoryModule,
    RequestMessagesModule,
  ],
  exports: [RequestsService],
})
export class RequestsModule {}
