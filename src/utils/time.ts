// Местные дата/время пользователя по IANA-поясу. Только Intl, без сторонних библиотек.
// Хост Render работает в UTC, поэтому всё «сегодня/сейчас/неделя» считается здесь.

export const DEFAULT_TZ = 'Europe/Moscow';

export interface LocalNow {
  dateStr: string; // YYYY-MM-DD
  hhmm: string; // HH:MM, 00..23
  weekday: number; // 0=пн .. 6=вс
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(tz, f);
  }
  return f;
}

function partsOf(date: Date, tz: string): { y: number; m: number; d: number; h: number; min: number } {
  const parts = formatter(tz).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, min: get('minute') };
}

const pad = (n: number) => String(n).padStart(2, '0');

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseDateStr(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

// 0=пн .. 6=вс для календарной даты (не зависит от пояса).
function weekdayOf(dateStr: string): number {
  const { y, m, d } = parseDateStr(dateStr);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function localNow(tz: string, now: Date = new Date()): LocalNow {
  const p = partsOf(now, tz);
  const dateStr = toDateStr(p.y, p.m, p.d);
  return { dateStr, hhmm: `${pad(p.h)}:${pad(p.min)}`, weekday: weekdayOf(dateStr) };
}

export function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDateStr(dateStr);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toDateStr(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// Сколько календарных дней от a до b (b - a).
export function daysBetween(a: string, b: string): number {
  const pa = parseDateStr(a);
  const pb = parseDateStr(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

// Смещение пояса относительно UTC в мс в данный момент.
function offsetMs(tz: string, at: Date): number {
  const p = partsOf(at, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return asUtc - Math.floor(at.getTime() / 60_000) * 60_000;
}

function localTimeToUtc(dateStr: string, hours: number, minutes: number, tz: string): Date {
  const { y, m, d } = parseDateStr(dateStr);
  const guess = Date.UTC(y, m - 1, d, hours, minutes);
  let result = guess - offsetMs(tz, new Date(guess));
  // Вторая итерация на случай перехода на летнее время между guess и result.
  result = guess - offsetMs(tz, new Date(result));
  return new Date(result);
}

export function localMidnightUtc(dateStr: string, tz: string): Date {
  return localTimeToUtc(dateStr, 0, 0, tz);
}

// Полдень выбранного местного дня — безопасная точка: дата не «съедет» ни в каком поясе.
export function localNoonUtc(dateStr: string, tz: string): Date {
  return localTimeToUtc(dateStr, 12, 0, tz);
}

// Понедельник местной недели, в которую попадает момент `at`.
export function weekStartOf(at: Date, tz: string): string {
  const { dateStr, weekday } = localNow(tz, at);
  return addDays(dateStr, -weekday);
}

export function localWeekStart(tz: string, now: Date = new Date()): string {
  return weekStartOf(now, tz);
}
