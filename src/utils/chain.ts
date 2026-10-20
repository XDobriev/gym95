import { addDays, daysBetween } from './time';

export interface ChainStatus {
  current: number; // дней в текущей живой цепочке (0 — цепочка прервана или её нет)
  best: number; // рекорд
  deadline: string | null; // последний день, когда тренировка ещё продлит цепочку
}

// Цепочка — подряд идущие дни тренировок, между которыми не больше maxGapDays дней
// отдыха. Несколько тренировок в один день — один день цепочки.
export function computeChain(dates: string[], today: string, maxGapDays: number): ChainStatus {
  const days = [...new Set(dates)].filter((d) => d <= today).sort();
  if (days.length === 0) return { current: 0, best: 0, deadline: null };

  const maxStep = maxGapDays + 1;
  let run = 1;
  let best = 1;
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) <= maxStep ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const last = days[days.length - 1];
  if (daysBetween(last, today) > maxStep) return { current: 0, best, deadline: null };
  return { current: run, best, deadline: addDays(last, maxStep) };
}

// Двойная прогрессия: если во всех подходах с рабочим (максимальным) весом сделано
// не меньше целевых повторений — предложить следующий вес. null — пока рано.
export function progressionSuggestion(sets: { weight: number; reps: number }[], targetReps: number | null): number | null {
  if (!targetReps || sets.length === 0) return null;
  const working = Math.max(...sets.map((s) => s.weight));
  if (working <= 0) return null;
  const workSets = sets.filter((s) => s.weight === working);
  if (!workSets.every((s) => s.reps >= targetReps)) return null;
  const step = working < 20 ? 1 : 2.5;
  return Math.round((working + step) * 10) / 10;
}

// Следующий шаблон в чередовании (A → B → A …). Неизвестный/пустой прошлый — первый.
export function suggestNextInRotation(orderedIds: string[], lastUsedId: string | null): string | null {
  if (orderedIds.length === 0) return null;
  const i = lastUsedId ? orderedIds.indexOf(lastUsedId) : -1;
  return orderedIds[(i + 1) % orderedIds.length];
}
