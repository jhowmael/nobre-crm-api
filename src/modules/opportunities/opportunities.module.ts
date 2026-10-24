import { Module } from '@nestjs/common';
import { CatalogsModule } from '../catalogs/catalogs.module.js';
import { StageHistoriesModule } from '../stage-histories/stage-histories.module.js';
import { OpportunitiesController } from './opportunities.controller.js';
import { OpportunitiesRepository } from './opportunities.repository.js';
import { OpportunitiesService } from './opportunities.service.js';

@Module({
  imports: [StageHistoriesModule, CatalogsModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, OpportunitiesRepository],
  exports: [OpportunitiesRepository],
})
export class OpportunitiesModule {}
