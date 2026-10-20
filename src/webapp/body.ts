import { getModules } from '../db/modules';
import { getUserTimezone } from '../db/profiles';
import { getSleepSince } from '../db/sleep';
import { getFoodBetween } from '../db/food';
import { supabase } from '../db/client';
import { loadDailyWeights } from '../modules/body';
import { getChainInfo } from '../modules/activity';
import { getKcalNorm } from '../modules/food';
import { getWaterStatus } from '../modules/water';
import { addDays, localNow } from '../utils/time';
import { weightStats } from '../utils/body';
import { averagePerDay } from '../utils/food';
import { MEASURE_FIELDS } from '../utils/measure';
import { BodyResponse } from '../types/webapp';

async function lastTwoMeasurements(userId: number): Promise<BodyResponse['measurements']> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select()
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2);
  if (error) throw new Error(`lastTwoMeasurements: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const values: Record<string, number | null> = {};
    for (const f of MEASURE_FIELDS) values[f.key] = row[f.key] === null ? null : Number(row[f.key]);
    return { date: row.measured_on as string, values };
  });
}

// Всё для вкладки «Тело» одним запросом: Mini App открывают раз в несколько дней,
// поэтому проще отдать сразу всё, чем гонять по запросу на график.
export async function getBody(userId: number): Promise<BodyResponse> {
  const tz = await getUserTimezone(userId);
  const today = localNow(tz).dateStr;
  const rows = await getModules(userId);
  const on = (m: string) => rows.some((r) => r.module === m && r.enabled);
  const modules = { weight: on('weight'), sleep: on('sleep'), food: on('food'), water: on('water'), activity: on('activity') };

  const [weights, sleepLogs, foodEntries, kcalNorm, water, chain, measurements] = await Promise.all([
    loadDailyWeights(userId, tz, 90),
    getSleepSince(userId, addDays(today, -29)),
    getFoodBetween(userId, addDays(today, -29), today),
    getKcalNorm(userId),
    getWaterStatus(userId, tz, today),
    getChainInfo(userId).catch(() => null),
    lastTwoMeasurements(userId),
  ]);

  const stats = weightStats(weights, today);

  const foodByDay = new Map<string, number>();
  for (const e of foodEntries) foodByDay.set(e.eaten_on, (foodByDay.get(e.eaten_on) ?? 0) + e.kcal);
  const from7 = addDays(today, -6);
  const sleep7 = sleepLogs.filter((s) => s.sleep_date >= from7);

  return {
    modules,
    weights: weights.map((w) => ({ date: w.dateStr, kg: w.kg })),
    weightAvg7: stats.avg7,
    weightWeekChange: stats.weekChange,
    weightMonthChange: stats.monthChange,
    sleep: sleepLogs.map((s) => ({ date: s.sleep_date, hours: s.hours })),
    sleepAvg7: sleep7.length ? Math.round((sleep7.reduce((a, s) => a + s.hours, 0) / sleep7.length) * 100) / 100 : null,
    food: [...foodByDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, kcal]) => ({ date, kcal })),
    foodAvg7: averagePerDay(foodEntries.filter((e) => e.eaten_on >= from7)),
    kcalNorm,
    waterTodayMl: water.drunkMl,
    waterTargetMl: water.targetMl,
    chain: chain ? { current: chain.current, best: chain.best, goal: chain.goal, deadline: chain.deadline } : null,
    measurements,
  };
}
