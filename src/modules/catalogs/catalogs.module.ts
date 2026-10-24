import { Module } from '@nestjs/common';
import { CatalogsController } from './catalogs.controller.js';
import { CatalogsRepository } from './catalogs.repository.js';
import { CatalogsService } from './catalogs.service.js';

@Module({
  controllers: [CatalogsController],
  providers: [CatalogsService, CatalogsRepository],
  exports: [CatalogsRepository],
})
export class CatalogsModule {}
