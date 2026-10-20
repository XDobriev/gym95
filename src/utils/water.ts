export const DEFAULT_WATER_REMINDER_TIMES = ['10:00', '13:00', '16:00', '19:00'];
export const WORKOUT_BONUS_ML = 500;

export function waterTargetMl(baseMl: number, hadWorkoutToday: boolean): number {
  return baseMl + (hadWorkoutToday ? WORKOUT_BONUS_ML : 0);
}

// Напоминание — только в одно из времён пользователя и только если норма ещё не набрана.
export function waterReminderDue(hhmm: string, drunkMl: number, targetMl: number, times: string[]): boolean {
  return times.includes(hhmm) && drunkMl < targetMl;
}

export function formatLitersShort(ml: number): string {
  return (ml / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

const MAX_TIMES = 8;

// «10:00, 13:00 16:00», «9:30» → ['09:30', …] по возрастанию без повторов. null — ошибка.
export function parseReminderTimes(text: string): string[] | null {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > MAX_TIMES) return null;
  const out = new Set<string>();
  for (const t of tokens) {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t);
    if (!m) return null;
    out.add(`${m[1].padStart(2, '0')}:${m[2]}`);
  }
  return [...out].sort();
}

// «2.75», «2,5», «3» литра → мл, кратно 50. null — вне 1–5 л.
export function parseLiters(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.round((n * 1000) / 50) * 50;
}
