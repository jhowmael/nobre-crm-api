import { Module } from '@nestjs/common';
import { OpportunitiesModule } from '../opportunities/opportunities.module.js';
import { FollowupTasksController } from './followup-tasks.controller.js';
import { FollowupTasksRepository } from './followup-tasks.repository.js';
import { FollowupTasksScheduler } from './followup-tasks.scheduler.js';
import { FollowupTasksService } from './followup-tasks.service.js';

@Module({
  imports: [OpportunitiesModule],
  controllers: [FollowupTasksController],
  providers: [FollowupTasksService, FollowupTasksRepository, FollowupTasksScheduler],
})
export class FollowupTasksModule {}
