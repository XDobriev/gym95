import { Telegraf } from 'telegraf';
import { getAllWorkoutsForExport } from '../db/workouts';
import { getExercisesForWorkouts } from '../db/exercises';
import { getCardioHistory } from '../db/cardio';
import { getWeightsSince, getUserTimezone, getProfile } from '../db/profiles';
import { computeChain } from '../utils/chain';
import { localNow, addDays } from '../utils/time';
import { evaluateBadges, formatBadgesShowcase, UserStatsForBadges } from '../modules/achievements';
import { Exercise, Workout } from '../types/domain';

export function registerAchievements(bot: Telegraf): void {
  bot.command(['achievements', 'badges', 'awards'], async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const tz = await getUserTimezone(userId);
      const today = localNow(tz).dateStr;
      const oneYearAgo = addDays(today, -365);

      const [workouts, cardioList, profile, weights] = await Promise.all([
        getAllWorkoutsForExport(userId).catch(() => [] as Workout[]),
        getCardioHistory(userId).catch(() => []),
        getProfile(userId).catch(() => null),
        getWeightsSince(userId, oneYearAgo).catch(() => []),
      ]);

      const workoutIds = workouts.map((w: Workout) => w.id);
      const exercises = await getExercisesForWorkouts(workoutIds).catch(() => [] as Exercise[]);

      // Считаем показатели
      const workoutDates = workouts.map((w: Workout) => w.date.slice(0, 10));
      const chain = computeChain(workoutDates, today, 2);

      let maxWeightLifted = 0;
      let maxSingleWorkoutTonnage = 0;

      const exercisesByWorkout = new Map<string, Exercise[]>();
      for (const ex of exercises) {
        const list = exercisesByWorkout.get(ex.workout_id) ?? [];
        list.push(ex);
        exercisesByWorkout.set(ex.workout_id, list);
      }

      for (const w of workouts) {
        let workoutTonnage = 0;
        const wExercises = exercisesByWorkout.get(w.id) ?? [];
        for (const ex of wExercises) {
          for (const s of ex.sets) {
            if (s.weight > maxWeightLifted) maxWeightLifted = s.weight;
            workoutTonnage += s.weight * s.reps;
          }
        }
        if (workoutTonnage > maxSingleWorkoutTonnage) maxSingleWorkoutTonnage = workoutTonnage;
      }

      // Кардио и стадион
      let totalCardioKm = 0;
      for (const c of cardioList) {
        if (c.distanceKm) totalCardioKm += c.distanceKm;
      }
      // Оценка кругов: каждый 0.4 км = 1 круг
      const totalStadiumLaps = Math.round(totalCardioKm / 0.4);

      // Динамика веса
      let weightLossKg = 0;
      if (weights.length >= 2) {
        const startWeight = weights[0].kg;
        const currentWeight = weights[weights.length - 1].kg;
        if (profile?.goal === 'lose') {
          weightLossKg = Math.max(0, Math.round((startWeight - currentWeight) * 10) / 10);
        }
      }

      const stats: UserStatsForBadges = {
        totalWorkouts: workouts.length,
        totalStadiumLaps,
        totalCardioKm: Math.round(totalCardioKm * 10) / 10,
        maxWeightLifted,
        maxSingleWorkoutTonnage,
        currentStreakDays: chain.current,
        bestStreakDays: chain.best,
        consecutiveWaterDays: 0,
        weightLossKg,
      };

      const badges = evaluateBadges(stats);
      const message = formatBadgesShowcase(badges);

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Ошибка получения достижений:', err);
      await ctx.reply('Не удалось загрузить витрину наград. Попробуй позже.');
    }
  });
}
