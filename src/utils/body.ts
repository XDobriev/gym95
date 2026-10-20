import { addDays, daysBetween, localNow } from './time';
import { parseDayMonth } from './parse';

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// «130.4», «130,4». null — не число или вне 35–300 кг.
export function parseWeightValue(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 35 || n > 300) return null;
  return round1(n);
}

// «7.5», «7,5», «7:40», «6ч30», «8». null — не распознано или вне 0–16 ч.
export function parseSleepHours(text: string): number | null {
  const t = text.trim().toLowerCase();
  const hm = /^(\d{1,2})\s*(?::|ч)\s*(\d{1,2})$/.exec(t);
  let hours: number;
  if (hm) {
    const m = Number(hm[2]);
    if (m >= 60) return null;
    hours = Number(hm[1]) + m / 60;
  } else {
    hours = Number(t.replace(',', '.'));
  }
  if (!Number.isFinite(hours) || hours <= 0 || hours > 16) return null;
  return round2(hours);
}

export function formatHours(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export type ValueWithDate = { ok: true; value: string; dateStr: string | null } | { ok: false; error: string };

// Аргументы команд вида «/weight 131.2 09.10»: значение и необязательная дата дд.мм.
export function parseValueWithDate(args: string, todayStr: string): ValueWithDate {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 2) return { ok: false, error: 'Формат: значение и, если нужно, дата: 131.2 09.10' };
  if (tokens.length === 1) return { ok: true, value: tokens[0], dateStr: null };
  const date = parseDayMonth(tokens[1], todayStr);
  if (!date.ok) return { ok: false, error: date.error };
  return { ok: true, value: tokens[0], dateStr: date.dateStr };
}

export interface DayWeight {
  dateStr: string;
  kg: number;
}

// По одному значению на местный день — самое раннее взвешивание (утреннее, натощак).
export function dailyWeights(rows: { at: string; kg: number }[], tz: string): DayWeight[] {
  const byDay = new Map<string, { t: number; kg: number }>();
  for (const r of rows) {
    const t = new Date(r.at).getTime();
    const day = localNow(tz, new Date(r.at)).dateStr;
    const cur = byDay.get(day);
    if (!cur || t < cur.t) byDay.set(day, { t, kg: r.kg });
  }
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([dateStr, v]) => ({ dateStr, kg: v.kg }));
}

export interface WeightStats {
  latest: DayWeight | null;
  avg7: number | null; // среднее за последние 7 дней (нужно ≥2 взвешивания)
  weekChange: number | null; // avg7 против среднего предыдущих 7 дней
  monthChange: number | null; // последний вес против первого за 30 дней (если тот старше недели)
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function weightStats(days: DayWeight[], today: string): WeightStats {
  const sorted = [...days].filter((d) => d.dateStr <= today).sort((a, b) => (a.dateStr < b.dateStr ? -1 : 1));
  const latest = sorted[sorted.length - 1] ?? null;
  if (!latest) return { latest: null, avg7: null, weekChange: null, monthChange: null };

  const inRange = (from: number, to: number) =>
    sorted.filter((d) => {
      const back = daysBetween(d.dateStr, today);
      return back >= from && back <= to;
    });

  const last7 = inRange(0, 6);
  const prev7 = inRange(7, 13);
  const avg7raw = last7.length >= 2 ? avg(last7.map((d) => d.kg)) : null;
  const prevAvg = prev7.length ? avg(prev7.map((d) => d.kg)) : null;

  const month = inRange(0, 30);
  const first = month[0];
  const monthChange = first && daysBetween(first.dateStr, latest.dateStr) >= 7 ? round2(latest.kg - first.kg) : null;

  return {
    latest,
    avg7: avg7raw !== null ? round2(avg7raw) : null,
    weekChange: avg7raw !== null && prevAvg !== null ? round2(avg7raw - prevAvg) : null,
    monthChange,
  };
}

export function formatDelta(n: number): string {
  const s = n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  return n > 0 ? `+${s}` : n < 0 ? s.replace('-', '−') : '0';
}

export function yesterdayOf(today: string): string {
  return addDays(today, -1);
}
