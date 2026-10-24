import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FollowupTasksService } from './followup-tasks.service.js';

@Injectable()
export class FollowupTasksScheduler {
  private readonly logger = new Logger(FollowupTasksScheduler.name);

  constructor(private readonly service: FollowupTasksService) {}

  @Cron('0 7 * * 1-5', { name: 'followup-tasks-generation', timeZone: 'America/Sao_Paulo' })
  async generateDaily() {
    try {
      await this.service.generate();
    } catch (error) {
      this.logger.error('Falha ao gerar as tarefas de retorno.', error instanceof Error ? error.stack : String(error));
    }
  }
}
