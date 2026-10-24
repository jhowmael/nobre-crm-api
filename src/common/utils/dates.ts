const MS_PER_DAY = 86_400_000;

const utc = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

export const toDateOnly = (value: Date | null | undefined): string | null => (value ? value.toISOString().slice(0, 10) : null);

export const fromDateOnly = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / MS_PER_DAY);

export const addDays = (iso: string, days: number) => new Date(utc(iso) + days * MS_PER_DAY).toISOString().slice(0, 10);

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
