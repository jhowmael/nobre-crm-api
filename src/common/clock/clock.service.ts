import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { daysBetween } from '../utils/dates.js';

export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const businessDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const toBusinessDate = (value: Date) => businessDate.format(value);

@Injectable()
export class ClockService {
  constructor(private readonly config: ConfigService) {}

  private fixedDate(): string | null {
    return this.config.get<string>('APP_TODAY')?.trim() || null;
  }

  today(): string {
    return this.fixedDate() ?? businessDate.format(new Date());
  }

  now(): Date {
    const fixed = this.fixedDate();
    if (!fixed) return new Date();
    const real = new Date();
    return new Date(real.getTime() + daysBetween(toBusinessDate(real), fixed) * 86_400_000);
  }
}
