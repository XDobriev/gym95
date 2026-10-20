import { getWeightsSince } from '../db/profiles';
import { getSleepSince } from '../db/sleep';
import { getModules, ModuleId } from '../db/modules';
import { addDays, localMidnightUtc, localNow } from '../utils/time';
import { dailyWeights, DayWeight, formatDelta, formatHours, weightStats, WeightStats } from '../utils/body';

const fmtKg = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

export async function isModuleEnabled(userId: number, module: ModuleId): Promise<boolean> {
  return (await getModules(userId)).some((r) => r.module === module && r.enabled);
}

export async function loadDailyWeights(userId: number, tz: string, days: number): Promise<DayWeight[]> {
  const today = localNow(tz).dateStr;
  const since = localMidnightUtc(addDays(today, -days), tz).toISOString();
  return dailyWeights(await getWeightsSince(userId, since), tz);
}

export async function loadWeightStats(userId: number, tz: string): Promise<{ stats: WeightStats; days: DayWeight[] }> {
  const days = await loadDailyWeights(userId, tz, 60);
  return { stats: weightStats(days, localNow(tz).dateStr), days };
}

// Строка после записи веса: среднее и изменение за неделю.
export function weightTrendLine(s: WeightStats): string {
  const parts: string[] = [];
  if (s.avg7 !== null) parts.push(`среднее за 7 дн: ${fmtKg(s.avg7)}`);
  if (s.weekChange !== null) parts.push(`${formatDelta(s.weekChange)} за неделю`);
  return parts.join(' · ');
}

export async function weightTodaySection(userId: number, tz: string, todayStr: string): Promise<string> {
  const { stats } = await loadWeightStats(userId, tz);
  if (!stats.latest) return '⚖️ Вес ещё не записан — /weight 130.4';
  const when = stats.latest.dateStr === todayStr ? 'сегодня' : `последний ${stats.latest.dateStr.slice(8)}.${stats.latest.dateStr.slice(5, 7)}`;
  const trend = weightTrendLine(stats);
  return `⚖️ Вес: ${fmtKg(stats.latest.kg)} кг (${when})${trend ? `\n   ${trend}` : ''}`;
}

export async function sleepAverage(userId: number, todayStr: string): Promise<{ today: number | null; avg7: number | null }> {
  const logs = await getSleepSince(userId, addDays(todayStr, -6));
  const today = logs.find((l) => l.sleep_date === todayStr)?.hours ?? null;
  const avg7 = logs.length >= 2 ? logs.reduce((a, l) => a + l.hours, 0) / logs.length : null;
  return { today, avg7 };
}

export async function sleepTodaySection(userId: number, todayStr: string): Promise<string> {
  const { today, avg7 } = await sleepAverage(userId, todayStr);
  const avgLine = avg7 !== null ? `\n   в среднем за неделю: ${formatHours(avg7)}` : '';
  if (today === null) return `😴 Сон этой ночью не записан — /sleep 7.5${avgLine}`;
  return `😴 Сон: ${formatHours(today)}${avgLine}`;
}

export { fmtKg };
