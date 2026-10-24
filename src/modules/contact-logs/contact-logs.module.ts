import { Module } from '@nestjs/common';
import { ContactLogsController } from './contact-logs.controller.js';
import { ContactLogsRepository } from './contact-logs.repository.js';
import { ContactLogsService } from './contact-logs.service.js';

@Module({
  controllers: [ContactLogsController],
  providers: [ContactLogsService, ContactLogsRepository],
})
export class ContactLogsModule {}
