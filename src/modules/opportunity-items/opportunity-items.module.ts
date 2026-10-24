import { Module } from '@nestjs/common';
import { OpportunityItemsController } from './opportunity-items.controller.js';
import { OpportunityItemsRepository } from './opportunity-items.repository.js';
import { OpportunityItemsService } from './opportunity-items.service.js';

@Module({
  controllers: [OpportunityItemsController],
  providers: [OpportunityItemsService, OpportunityItemsRepository],
})
export class OpportunityItemsModule {}
