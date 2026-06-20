import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { RequestsService } from './requests.service';
import { RequestAutoCompleteSettingsService } from './request-auto-complete-settings.service';

const JOB_NAME = 'requests-auto-complete';

@Injectable()
export class RequestsAutoCompleteJob implements OnModuleInit {
  private readonly logger = new Logger(RequestsAutoCompleteJob.name);

  constructor(
    private readonly requestsService: RequestsService,
    private readonly settingsService: RequestAutoCompleteSettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const cronExpression = await this.settingsService.getCronExpression();
    await this.refreshSchedule(cronExpression);
  }

  async refreshSchedule(cronExpression: string): Promise<void> {
    const normalized = this.settingsService.normalizeCronExpression(cronExpression);
    this.settingsService.assertValidCronExpression(normalized);

    if (this.schedulerRegistry.doesExist('cron', JOB_NAME)) {
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
    }

    const job = new CronJob(normalized, () => {
      void this.handleCron();
    });

    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    job.start();

    this.logger.log(`Job "${JOB_NAME}" agendado com cron: ${normalized}`);
  }

  /** Dispara `RequestsService.autoCompleteExpiredSolvedRequests()` */
  async handleCron(): Promise<void> {
    try {
      const count = await this.requestsService.autoCompleteExpiredSolvedRequests();

      if (count > 0) {
        this.logger.log(`${count} solicitação(ões) SOLVED concluída(s) automaticamente`);
      }
    } catch (error) {
      this.logger.error('Falha ao concluir solicitações SOLVED expiradas', error);
    }
  }
}
