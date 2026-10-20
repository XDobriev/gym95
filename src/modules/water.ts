import { getModules } from '../db/modules';
import { getWaterForDay } from '../db/water';
import { countWorkoutsSince } from '../db/workouts';
import { localMidnightUtc } from '../utils/time';
import { DEFAULT_WATER_REMINDER_TIMES, formatLitersShort, waterTargetMl } from '../utils/water';
import { UserModuleRow } from '../db/modules';

export const DEFAULT_WATER_ML = 2500;

export function waterSettingsOf(row: UserModuleRow | undefined): { baseMl: number; times: string[] } {
  const base = Number(row?.settings.dailyMl ?? DEFAULT_WATER_ML) || DEFAULT_WATER_ML;
  const raw = row?.settings.reminderTimes;
  const times = Array.isArray(raw) && raw.every((t) => typeof t === 'string') ? (raw as string[]) : DEFAULT_WATER_REMINDER_TIMES;
  return { baseMl: base, times };
}

export interface WaterStatus {
  drunkMl: number;
  targetMl: number;
  workoutBonus: boolean;
}

export async function getWaterStatus(userId: number, tz: string, today: string): Promise<WaterStatus> {
  const [rows, drunkMl, workoutsToday] = await Promise.all([
    getModules(userId),
    getWaterForDay(userId, today),
    countWorkoutsSince(userId, localMidnightUtc(today, tz).toISOString()),
  ]);
  const { baseMl } = waterSettingsOf(rows.find((r) => r.module === 'water'));
  const workoutBonus = workoutsToday > 0;
  return { drunkMl, targetMl: waterTargetMl(baseMl, workoutBonus), workoutBonus };
}

function bar(drunk: number, target: number): string {
  const filled = Math.min(10, Math.round((drunk / target) * 10));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

export function waterStatusText(s: WaterStatus): string {
  const done = s.drunkMl >= s.targetMl;
  return (
    `💧 Вода: ${formatLitersShort(s.drunkMl)} / ${formatLitersShort(s.targetMl)} л${done ? ' ✓' : ''}\n` +
    `${bar(s.drunkMl, s.targetMl)}` +
    (s.workoutBonus ? '\n+0,5 л к норме — сегодня тренировка' : '')
  );
}

export async function waterTodaySection(userId: number, tz: string, today: string): Promise<string> {
  return waterStatusText(await getWaterStatus(userId, tz, today));
}
