import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApiKeyGuard } from './common/auth/api-key.guard.js';
import { ClockModule } from './common/clock/clock.module.js';
import { HealthModule } from './common/health/health.module.js';
import { DEFAULT_THROTTLE_LIMIT, DEFAULT_THROTTLE_TTL_SECONDS, validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { CatalogsModule } from './modules/catalogs/catalogs.module.js';
import { ContactLogsModule } from './modules/contact-logs/contact-logs.module.js';
import { FollowupTasksModule } from './modules/followup-tasks/followup-tasks.module.js';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module.js';
import { OpportunityItemsModule } from './modules/opportunity-items/opportunity-items.module.js';
import { SellersModule } from './modules/sellers/sellers.module.js';
import { StageHistoriesModule } from './modules/stage-histories/stage-histories.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: seconds(config.get<number>('THROTTLE_TTL_SECONDS') ?? DEFAULT_THROTTLE_TTL_SECONDS),
            limit: config.get<number>('THROTTLE_LIMIT') ?? DEFAULT_THROTTLE_LIMIT,
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ClockModule,
    HealthModule,
    CatalogsModule,
    SellersModule,
    OpportunitiesModule,
    OpportunityItemsModule,
    StageHistoriesModule,
    ContactLogsModule,
    FollowupTasksModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule {}
