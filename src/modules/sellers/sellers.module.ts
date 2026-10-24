import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller.js';
import { SellersRepository } from './sellers.repository.js';
import { SellersService } from './sellers.service.js';

@Module({
  controllers: [SellersController],
  providers: [SellersService, SellersRepository],
})
export class SellersModule {}
