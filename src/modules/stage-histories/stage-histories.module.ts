import { Module } from '@nestjs/common';
import { StageHistoriesController } from './stage-histories.controller.js';
import { StageHistoriesRepository } from './stage-histories.repository.js';
import { StageHistoriesService } from './stage-histories.service.js';

@Module({
  controllers: [StageHistoriesController],
  providers: [StageHistoriesService, StageHistoriesRepository],
  exports: [StageHistoriesRepository],
})
export class StageHistoriesModule {}
