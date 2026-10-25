import { ConfigService } from '@nestjs/config';
import { ClockService, toBusinessDate } from '../src/common/clock/clock.service.js';

const clockWith = (APP_TODAY?: string) => new ClockService(new ConfigService(APP_TODAY === undefined ? {} : { APP_TODAY }));

describe('ClockService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa APP_TODAY quando definida', () => {
    const clock = clockWith('2026-10-15');
    expect(clock.today()).toBe('2026-10-15');
    expect(toBusinessDate(clock.now())).toBe('2026-10-15');
  });

  it('com APP_TODAY, mantém a data fixa e a hora de São Paulo quando o dia em UTC já virou', () => {
    vi.useFakeTimers({ now: new Date('2026-10-21T01:30:00.000Z') });
    const now = clockWith('2026-10-15').now();
    expect(now.toISOString()).toBe('2026-10-16T01:30:00.000Z');
    expect(toBusinessDate(now)).toBe('2026-10-15');
  });

  it('trata APP_TODAY vazia como ausente', () => {
    vi.useFakeTimers({ now: new Date('2026-03-10T12:00:00.000Z') });
    expect(clockWith('').today()).toBe('2026-03-10');
    expect(clockWith('  ').now().toISOString()).toBe('2026-03-10T12:00:00.000Z');
  });

  it('calcula o dia no fuso de São Paulo, não em UTC', () => {
    vi.useFakeTimers({ now: new Date('2026-10-16T01:30:00.000Z') });
    expect(clockWith().today()).toBe('2026-10-15');
  });
});
