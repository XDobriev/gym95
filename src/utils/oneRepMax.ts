import { SetEntry } from '../types/domain';

/**
 * Расчёт 1RM (одноповторного максимума) по формуле Эпли:
 * 1RM = weight * (1 + reps / 30)
 * Для 1 повторения: 1RM = weight.
 * Если вес <= 0 или повторения <= 0: возвращает 0.
 */
export function calculate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  const raw1RM = weight * (1 + reps / 30);
  return Math.round(raw1RM * 10) / 10;
}

export interface ExerciseStats {
  isBodyweight: boolean;
  totalWorkouts: number;
  totalSets: number;
  allTimeBest1RM: {
    oneRepMax: number;
    weight: number;
    reps: number;
    date: string;
  } | null;
  recent1RM: {
    oneRepMax: number;
    weight: number;
    reps: number;
    date: string;
  } | null;
  first1RM: {
    oneRepMax: number;
    weight: number;
    reps: number;
    date: string;
  } | null;
  maxWeightSet: {
    weight: number;
    reps: number;
    date: string;
  } | null;
  growthKg: number;
  growthPct: number;
  maxRepsSet: {
    reps: number;
    date: string;
  } | null;
}

export function calculateExerciseStats(
  history: { date: string; sets: SetEntry[] }[]
): ExerciseStats {
  const isBodyweight = history.every((entry) => entry.sets.every((s) => s.weight === 0));
  let totalSets = 0;
  let allTimeBest1RM: ExerciseStats['allTimeBest1RM'] = null;
  let maxWeightSet: ExerciseStats['maxWeightSet'] = null;
  let maxRepsSet: ExerciseStats['maxRepsSet'] = null;

  let first1RM: ExerciseStats['first1RM'] = null;
  let recent1RM: ExerciseStats['recent1RM'] = null;

  for (const entry of history) {
    totalSets += entry.sets.length;
    let dayBest1RM: ExerciseStats['allTimeBest1RM'] = null;

    for (const set of entry.sets) {
      if (set.reps <= 0) continue;

      if (set.weight > 0) {
        const est1RM = calculate1RM(set.weight, set.reps);
        const setWith1RM = {
          oneRepMax: est1RM,
          weight: set.weight,
          reps: set.reps,
          date: entry.date,
        };

        if (!dayBest1RM || est1RM > dayBest1RM.oneRepMax) {
          dayBest1RM = setWith1RM;
        }

        if (!allTimeBest1RM || est1RM > allTimeBest1RM.oneRepMax) {
          allTimeBest1RM = setWith1RM;
        }

        if (!maxWeightSet || set.weight > maxWeightSet.weight) {
          maxWeightSet = {
            weight: set.weight,
            reps: set.reps,
            date: entry.date,
          };
        }
      } else {
        if (!maxRepsSet || set.reps > maxRepsSet.reps) {
          maxRepsSet = {
            reps: set.reps,
            date: entry.date,
          };
        }
      }
    }

    if (dayBest1RM) {
      if (!first1RM) first1RM = dayBest1RM;
      recent1RM = dayBest1RM;
    }
  }

  let growthKg = 0;
  let growthPct = 0;
  if (first1RM && recent1RM) {
    growthKg = Math.round((recent1RM.oneRepMax - first1RM.oneRepMax) * 10) / 10;
    if (first1RM.oneRepMax > 0) {
      growthPct = Math.round(((recent1RM.oneRepMax - first1RM.oneRepMax) / first1RM.oneRepMax) * 1000) / 10;
    }
  }

  return {
    isBodyweight,
    totalWorkouts: history.length,
    totalSets,
    allTimeBest1RM,
    recent1RM,
    first1RM,
    maxWeightSet,
    growthKg,
    growthPct,
    maxRepsSet,
  };
}

export function formatExerciseStatsSummary(stats: ExerciseStats): string[] {
  const lines: string[] = [];
  if (stats.isBodyweight) {
    if (stats.maxRepsSet) {
      lines.push(`🏆 Рекорд повторений: ${stats.maxRepsSet.reps} повт.`);
    }
    return lines;
  }

  if (stats.allTimeBest1RM) {
    lines.push(
      `🏆 Рекордный 1RM: ${stats.allTimeBest1RM.oneRepMax} кг (${stats.allTimeBest1RM.weight} кг × ${stats.allTimeBest1RM.reps})`
    );
  }
  if (
    stats.recent1RM &&
    stats.allTimeBest1RM &&
    stats.recent1RM.oneRepMax !== stats.allTimeBest1RM.oneRepMax
  ) {
    lines.push(
      `⚡ Текущий 1RM: ${stats.recent1RM.oneRepMax} кг (${stats.recent1RM.weight} кг × ${stats.recent1RM.reps})`
    );
  }
  if (
    stats.maxWeightSet &&
    (!stats.allTimeBest1RM || stats.maxWeightSet.weight !== stats.allTimeBest1RM.weight)
  ) {
    lines.push(`🥇 Макс. вес: ${stats.maxWeightSet.weight} кг`);
  }
  if (stats.growthKg !== 0 && stats.totalWorkouts > 1) {
    const sign = stats.growthKg > 0 ? '+' : '';
    lines.push(`📈 Прирост силы: ${sign}${stats.growthKg} кг (${sign}${stats.growthPct}%)`);
  }

  return lines;
}
