import { calculate1RM } from '../utils/oneRepMax';
import { supabase } from '../db/client';
import { getWorkoutsBetween } from '../db/workouts';
import { Workout } from '../types/domain';
import { getExercisesForWorkouts, getExerciseHistory } from '../db/exercises';
import { getCardioSessionsForWorkouts } from '../db/cardio';
import { getFoodBetween, FoodEntry } from '../db/food';
import { getSleepSince, SleepLog } from '../db/sleep';
import { getWaterBetween } from '../db/water';
import { getKcalNorm } from './food';
import { addDays, localMidnightUtc } from '../utils/time';

/**
 * Определяет, относится ли упражнение к нижней части тела или тяжелым базовым тягам/приседам,
 * где стандартный шаг прогрессии составляет 5 кг (вместо 2.5 кг для верхнего плечевого пояса).
 */
export function isLowerBodyOrCompound(exerciseName: string): boolean {
  const lower = exerciseName.toLowerCase();

  // Исключаем упражнения на верх тела (руки, бицепс, трицепс, грудь, верхние тяги)
  const isUpperBody =
    lower.includes('бицепс') ||
    lower.includes('трицепс') ||
    lower.includes('рук') ||
    lower.includes('груд') ||
    lower.includes('плеч') ||
    lower.includes('подбородок') ||
    lower.includes('верхн') ||
    lower.includes('горизонтальн') ||
    (lower.includes('блок') && !lower.includes('ног'));

  // Проверяем становую/румынскую тягу (тяжелый compound)
  const isDeadlift =
    lower.includes('станов') ||
    lower.includes('румынск') ||
    lower.includes('мертв') ||
    lower.includes('сумо') ||
    lower.includes('deadlift');

  if (isUpperBody && !isDeadlift) {
    return false;
  }

  if (isDeadlift) return true;

  const lowerKeywords = [
    'присед',
    'squat',
    'ногам',
    'ноги',
    'ног',
    'leg',
    'выпад',
    'lunge',
    'гакк',
    'ягодич',
    'hip thrust',
    'икр',
    'calf',
    'голен',
    'квадрицепс',
    'бицепс бедра',
  ];

  return lowerKeywords.some((kw) => lower.includes(kw));
}

export interface DoubleProgressionResult {
  achievedTarget: boolean;
  currentWorkingWeight: number;
  recommendedWeight: number;
  weightIncrement: number;
  reason: string;
  advice: string;
}

/**
 * Double Progression Method (Метод двойной прогрессии):
 * 1. Фиксируем вес и диапазон повторов (например, 8-10 или цель 10).
 * 2. Если все рабочие сеты закрыты на верхней границе повторов — рекомендуем прибавку к весу:
 *    +5 кг для приседа/тяги/ног, +2.5 кг для верха (или +1 кг для легких снарядов < 16 кг).
 * 3. Если хотя бы один подход не дотянул до цели — вес сохраняется, фокус на увеличении повторов.
 */
export function calculateDoubleProgression(
  exerciseName: string,
  sets: { weight: number; reps: number }[],
  target: { minReps: number; maxReps: number } | number = { minReps: 8, maxReps: 10 }
): DoubleProgressionResult | null {
  if (!sets || sets.length === 0) return null;
  const maxReps = typeof target === 'number' ? target : target.maxReps;
  const minReps = typeof target === 'number' ? target : target.minReps;

  const workingWeight = Math.max(...sets.map((s) => s.weight));
  if (workingWeight <= 0) return null;

  const workSets = sets.filter((s) => s.weight === workingWeight);
  if (workSets.length === 0) return null;

  const isLower = isLowerBodyOrCompound(exerciseName);
  let increment = isLower ? 5.0 : 2.5;
  if (workingWeight < 16) {
    increment = 1.0;
  }

  const allAtMaxReps = workSets.every((s) => s.reps >= maxReps);

  if (allAtMaxReps) {
    const nextWeight = Math.round((workingWeight + increment) * 10) / 10;
    return {
      achievedTarget: true,
      currentWorkingWeight: workingWeight,
      recommendedWeight: nextWeight,
      weightIncrement: increment,
      reason: `Все рабочие сеты (${workSets.length} шт.) закрыты на ${maxReps} повторов.`,
      advice: `🎯 Прогрессия: +${increment} кг к следующей тренировке (новый вес: ${nextWeight} кг). Начни с ${minReps} повторов.`,
    };
  } else {
    const lowestReps = Math.min(...workSets.map((s) => s.reps));
    return {
      achievedTarget: false,
      currentWorkingWeight: workingWeight,
      recommendedWeight: workingWeight,
      weightIncrement: 0,
      reason: `Не все сеты достигли максимума ${maxReps} повт. (минимум: ${lowestReps}).`,
      advice: `💪 Держи вес ${workingWeight} кг. Фокус на следующую тренировку — закрыть все сеты на ${maxReps} повторений.`,
    };
  }
}

export interface PlateauDiagnosis {
  hasPlateau: boolean;
  exerciseName: string;
  durationWeeks: number;
  sessionCount: number;
  stagnantWeight: number;
  bestEstimated1RM: number;
  recommendations: {
    deload: string;
    repRange: string;
    variation: string;
  };
}

/**
 * Диагностика плато:
 * Обнаруживает застой рабочих весов или 1RM на протяжении 3+ недель (минимум 3 сессии).
 * Предлагает делоад, смену диапазона повторов или вариации упражнения.
 */
export function diagnosePlateau(
  exerciseName: string,
  history: { date: string; sets: { weight: number; reps: number }[] }[]
): PlateauDiagnosis | null {
  if (!history || history.length < 3) return null;

  const firstTime = new Date(history[0].date).getTime();
  const lastTime = new Date(history[history.length - 1].date).getTime();
  const daysDiff = (lastTime - firstTime) / (1000 * 60 * 60 * 24);

  if (daysDiff < 20) return null;

  const durationWeeks = Math.max(3, Math.round(daysDiff / 7));

  const sessionStats = history
    .map((h) => {
      let max1RM = 0;
      let maxWeight = 0;
      for (const s of h.sets) {
        if (s.weight > 0 && s.reps > 0) {
          const est1RM = calculate1RM(s.weight, s.reps);
          if (est1RM > max1RM) max1RM = est1RM;
          if (s.weight > maxWeight) maxWeight = s.weight;
        }
      }
      return { date: h.date, max1RM, maxWeight };
    })
    .filter((s) => s.maxWeight > 0);

  if (sessionStats.length < 3) return null;

  const initial1RM = sessionStats[0].max1RM;
  const recent1RM = Math.max(...sessionStats.slice(-3).map((s) => s.max1RM));
  const latestWeight = sessionStats[sessionStats.length - 1].maxWeight;
  const overallBest1RM = Math.max(...sessionStats.map((s) => s.max1RM));

  const growthPercent = initial1RM > 0 ? ((recent1RM - initial1RM) / initial1RM) * 100 : 0;
  const isStagnant = growthPercent <= 1.0;

  if (!isStagnant) {
    return {
      hasPlateau: false,
      exerciseName,
      durationWeeks,
      sessionCount: sessionStats.length,
      stagnantWeight: latestWeight,
      bestEstimated1RM: overallBest1RM,
      recommendations: { deload: '', repRange: '', variation: '' },
    };
  }

  return {
    hasPlateau: true,
    exerciseName,
    durationWeeks,
    sessionCount: sessionStats.length,
    stagnantWeight: latestWeight,
    bestEstimated1RM: overallBest1RM,
    recommendations: {
      deload: `📉 Делоад (разгрузочная неделя): снизь рабочие веса на 10–15% на 1 неделю или уменьши сеты до 2. Это снимет накопленную усталость ЦНС и связок.`,
      repRange: `🔄 Смена диапазона: если делал 8–10 повторов, поработай 3–4 недели в режиме 5×5 (сила) или 3×12–15 (гипертрофия).`,
      variation: `⚡ Смена вариации: замени штангу на гантели, измени угол наклона или делай паузу 2 сек в нижней точке (spoto/paused).`,
    },
  };
}

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  totalWorkouts: number;
  strengthWorkouts: number;
  cardioWorkouts: number;
  totalTonnageKg: number;
  totalCardioKm: number;
  topPrProgress: Array<{
    exercise: string;
    new1RM: number;
    deltaKg: number;
    percent: number;
  }>;
  recovery: {
    avgSleepHours: number | null;
    sleepRating: 'good' | 'fair' | 'poor' | null;
    waterAvgPercent: number | null;
    foodAvgKcal: number | null;
    foodNormKcal: number | null;
  };
  coachSummary: string;
}

/**
 * Генерирует еженедельный дайджест (Weekly Report) с тоннажем, 1RM прогрессом и восстановлением.
 */
export async function generateWeeklyReport(
  userId: number,
  weekStartDateStr: string,
  weekEndDateStr: string,
  tz?: string
): Promise<WeeklyReportData> {
  const nextDayStr = addDays(weekEndDateStr, 1);
  const fromIso = tz ? localMidnightUtc(weekStartDateStr, tz).toISOString() : `${weekStartDateStr}T00:00:00.000Z`;
  const toIso = tz ? localMidnightUtc(nextDayStr, tz).toISOString() : `${nextDayStr}T00:00:00.000Z`;

  const [workouts, foodEntries, allSleepLogs, waterLogs, kcalNormVal] = await Promise.all([
    getWorkoutsBetween(userId, fromIso, toIso),
    getFoodBetween(userId, weekStartDateStr, weekEndDateStr).catch(() => [] as FoodEntry[]),
    getSleepSince(userId, weekStartDateStr).catch(() => [] as SleepLog[]),
    getWaterBetween(userId, weekStartDateStr, weekEndDateStr).catch(() => [] as { drunk_on: string; ml: number }[]),
    getKcalNorm(userId).catch(() => null),
  ]);

  const sleepLogs = allSleepLogs.filter((l: SleepLog) => l.sleep_date <= weekEndDateStr);

  const workoutIds = workouts.map((w: Workout) => w.id);
  const [exercises, cardioSessions] = await Promise.all([
    getExercisesForWorkouts(workoutIds).catch(() => []),
    getCardioSessionsForWorkouts(workoutIds).catch(() => []),
  ]);

  let totalTonnageKg = 0;
  const currentWeek1RMByExercise = new Map<string, number>();

  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.weight > 0 && s.reps > 0) {
        totalTonnageKg += s.weight * s.reps;
        const est1RM = calculate1RM(s.weight, s.reps);
        const prev = currentWeek1RMByExercise.get(ex.name) ?? 0;
        if (est1RM > prev) {
          currentWeek1RMByExercise.set(ex.name, est1RM);
        }
      }
    }
  }

  let totalCardioKm = 0;
  for (const c of cardioSessions) {
    if (c.distance_km) totalCardioKm += Number(c.distance_km);
  }

  const strengthCount = workouts.filter((w: Workout) => w.type === 'strength' || w.type === 'mixed').length;
  const cardioCount = workouts.filter((w: Workout) => w.type === 'cardio' || w.type === 'pool').length;

  // Рассчитываем топ-прогресс по 1RM
  const topPrProgress: WeeklyReportData['topPrProgress'] = [];
  for (const [name, current1RM] of currentWeek1RMByExercise) {
    const history = await getExerciseHistory(userId, name).catch(() => []);
    const pastSessions = history.filter((h) => h.date < fromIso);
    let pastBest1RM = 0;
    for (const ps of pastSessions) {
      for (const s of ps.sets) {
        if (s.weight > 0 && s.reps > 0) {
          const r = calculate1RM(s.weight, s.reps);
          if (r > pastBest1RM) pastBest1RM = r;
        }
      }
    }

    if (pastBest1RM > 0 && current1RM > pastBest1RM) {
      const deltaKg = Math.round((current1RM - pastBest1RM) * 10) / 10;
      const percent = Math.round((deltaKg / pastBest1RM) * 100);
      topPrProgress.push({
        exercise: name,
        new1RM: current1RM,
        deltaKg,
        percent,
      });
    }
  }

  topPrProgress.sort((a, b) => b.deltaKg - a.deltaKg);

  // Метрики восстановления
  let avgSleepHours: number | null = null;
  let sleepRating: 'good' | 'fair' | 'poor' | null = null;
  if (sleepLogs.length > 0) {
    const sumHours = sleepLogs.reduce((acc: number, l: SleepLog) => acc + Number(l.hours), 0);
    avgSleepHours = Math.round((sumHours / sleepLogs.length) * 10) / 10;
    if (avgSleepHours >= 7.5) sleepRating = 'good';
    else if (avgSleepHours >= 6.5) sleepRating = 'fair';
    else sleepRating = 'poor';
  }

  let foodAvgKcal: number | null = null;
  if (foodEntries.length > 0) {
    const sumKcal = foodEntries.reduce((acc: number, f: FoodEntry) => acc + Number(f.kcal), 0);
    foodAvgKcal = Math.round(sumKcal / Math.max(1, new Set(foodEntries.map((f: FoodEntry) => f.eaten_on)).size));
  }

  let waterAvgPercent: number | null = null;
  if (waterLogs.length > 0) {
    const totalMl = waterLogs.reduce((acc: number, w: { drunk_on: string; ml: number }) => acc + Number(w.ml), 0);
    const daysCount = Math.max(1, new Set(waterLogs.map((w: { drunk_on: string; ml: number }) => w.drunk_on)).size);
    const avgDailyMl = totalMl / daysCount;
    waterAvgPercent = Math.min(150, Math.round((avgDailyMl / 2500) * 100));
  }

  let coachSummary = '';
  if (workouts.length >= 3 && totalTonnageKg > 10000) {
    coachSummary = '🔥 Отличная ударная неделя! Тоннаж на высоте. Держи восстановление под контролем.';
  } else if (workouts.length > 0) {
    coachSummary = '⚡ Неделя закрыта стабильно. Фокусируйся на регулярности и прибавке в рабочих весах.';
  } else {
    coachSummary = '💤 Мало тренировочной активности. Самое время вернуться в зал и начать новую серию!';
  }

  return {
    weekStart: weekStartDateStr,
    weekEnd: weekEndDateStr,
    totalWorkouts: workouts.length,
    strengthWorkouts: strengthCount,
    cardioWorkouts: cardioCount,
    totalTonnageKg: Math.round(totalTonnageKg),
    totalCardioKm: Math.round(totalCardioKm * 10) / 10,
    topPrProgress: topPrProgress.slice(0, 3),
    recovery: {
      avgSleepHours,
      sleepRating,
      waterAvgPercent,
      foodAvgKcal,
      foodNormKcal: kcalNormVal,
    },
    coachSummary,
  };
}

/**
 * Форматирует персональный еженедельный дайджест в читаемый текст Telegram.
 */
export function formatWeeklyReport(report: WeeklyReportData): string {
  const lines: string[] = [];
  lines.push(`📊 <b>ЕЖЕНЕДЕЛЬНЫЙ ДАЙДЖЕСТ GYM95</b>`);
  lines.push(`Период: <code>${report.weekStart} — ${report.weekEnd}</code>`);
  lines.push('');

  lines.push('🏋️ <b>Нагрузка и тоннаж:</b>');
  const formattedTonnage = report.totalTonnageKg.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  lines.push(`• Тренировок всего: <b>${report.totalWorkouts}</b> (силовых: ${report.strengthWorkouts}, кардио: ${report.cardioWorkouts})`);
  lines.push(`• Общий тоннаж: <b>${formattedTonnage} кг</b>`);
  if (report.totalCardioKm > 0) {
    lines.push(`• Дистанция кардио: <b>${report.totalCardioKm} км</b>`);
  }
  lines.push('');

  if (report.topPrProgress.length > 0) {
    lines.push('🔥 <b>Топ-прогресс по 1RM (Личные рекорды):</b>');
    for (const pr of report.topPrProgress) {
      lines.push(`• <b>${pr.exercise}</b>: 1RM ~${pr.new1RM} кг (<b>+${pr.deltaKg} кг</b>, +${pr.percent}%)`);
    }
    lines.push('');
  }

  lines.push('🔋 <b>Баланс восстановления:</b>');
  if (report.recovery.avgSleepHours !== null) {
    const sleepIcon = report.recovery.sleepRating === 'good' ? '🟢' : report.recovery.sleepRating === 'fair' ? '🟡' : '🔴';
    lines.push(`• Сон: ${sleepIcon} <b>${report.recovery.avgSleepHours} ч/ночь</b>`);
  } else {
    lines.push('• Сон: нет данных');
  }

  if (report.recovery.waterAvgPercent !== null) {
    lines.push(`• Водный баланс: <b>${report.recovery.waterAvgPercent}%</b> от нормы`);
  }

  if (report.recovery.foodAvgKcal !== null) {
    const normStr = report.recovery.foodNormKcal ? ` / ${report.recovery.foodNormKcal}` : '';
    lines.push(`• Калории в среднем: <b>${report.recovery.foodAvgKcal}${normStr} ккал</b>`);
  }
  lines.push('');

  lines.push(`🧠 <b>Совет AI-Коуча:</b>`);
  lines.push(report.coachSummary);

  return lines.join('\n');
}
