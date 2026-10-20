import { daysBetween } from './time';
import { formatDelta } from './body';

export type MeasureKey = 'waist' | 'belly' | 'chest' | 'hips' | 'biceps' | 'thigh';

export const MEASURE_FIELDS: { key: MeasureKey; label: string; hint: string }[] = [
  { key: 'waist', label: 'Талия', hint: 'самое узкое место, на спокойном выдохе' },
  { key: 'belly', label: 'Живот', hint: 'по пупку' },
  { key: 'chest', label: 'Грудь', hint: 'по самой выступающей части, руки опущены' },
  { key: 'hips', label: 'Бёдра', hint: 'по самой выступающей части ягодиц' },
  { key: 'biceps', label: 'Бицепс', hint: 'всегда одна и та же рука, в расслабленном виде' },
  { key: 'thigh', label: 'Бедро', hint: 'всегда одна и та же нога, самое широкое место' },
];

export const MEASURE_INTERVAL_DAYS = 30;

export type Measurements = Partial<Record<MeasureKey, number | null>>;

export function parseCm(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 10 || n > 300) return null;
  return Math.round(n * 10) / 10;
}

const fmtCm = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

// Строки «Талия: 118 см (−3)» для заполненных замеров; разница — если есть прошлое значение.
export function measureDiffLines(current: Measurements, previous: Measurements | null): string[] {
  const lines: string[] = [];
  for (const f of MEASURE_FIELDS) {
    const v = current[f.key];
    if (v === null || v === undefined) continue;
    const prev = previous?.[f.key];
    const diff = prev !== null && prev !== undefined ? ` (${formatDelta(Math.round((v - prev) * 10) / 10)})` : '';
    lines.push(`${f.label}: ${fmtCm(v)} см${diff}`);
  }
  return lines;
}

export function measurementDue(lastDate: string | null, today: string): boolean {
  return lastDate === null || daysBetween(lastDate, today) >= MEASURE_INTERVAL_DAYS;
}
