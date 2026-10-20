export const WATER_REMINDER_TIMES = ['10:00', '13:00', '16:00', '19:00'];
export const WORKOUT_BONUS_ML = 500;

export function waterTargetMl(baseMl: number, hadWorkoutToday: boolean): number {
  return baseMl + (hadWorkoutToday ? WORKOUT_BONUS_ML : 0);
}

// Напоминание — только в одно из фиксированных времён и только если норма ещё не набрана.
export function waterReminderDue(hhmm: string, drunkMl: number, targetMl: number): boolean {
  return WATER_REMINDER_TIMES.includes(hhmm) && drunkMl < targetMl;
}

export function formatLitersShort(ml: number): string {
  return (ml / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}
