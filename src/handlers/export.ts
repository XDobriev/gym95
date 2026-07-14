import { Telegraf } from 'telegraf';
import { getAllWorkoutsForExport } from '../db/workouts';
import { getExercisesForWorkouts } from '../db/exercises';
import { getCardioSessionsForWorkouts } from '../db/cardio';
import { CardioSession, Exercise, Workout } from '../types/domain';
import { formatCardioInline, formatDateIsoDay, formatSetsInline, formatWorkoutTypeRu } from '../utils/format';

const TELEGRAM_MESSAGE_LIMIT = 4096;

function buildExportMarkdown(workouts: Workout[], exercises: Exercise[], cardioSessions: CardioSession[]): string {
  const exercisesByWorkout = new Map<string, Exercise[]>();
  for (const exercise of exercises) {
    const list = exercisesByWorkout.get(exercise.workout_id) ?? [];
    list.push(exercise);
    exercisesByWorkout.set(exercise.workout_id, list);
  }

  const cardioByWorkout = new Map(cardioSessions.map((c) => [c.workout_id, c]));

  const sections = workouts.map((workout) => {
    const durationSuffix = workout.duration_minutes ? ` (${workout.duration_minutes} мин)` : '';
    const header = `## ${formatDateIsoDay(workout.date)} — ${formatWorkoutTypeRu(workout.type)}${durationSuffix}`;

    const lines = (exercisesByWorkout.get(workout.id) ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => `- ${ex.name}: ${formatSetsInline(ex.sets)}`);

    if (workout.warmup_minutes) {
      lines.unshift(`- 🔥 Разминка: ${workout.warmup_minutes} мин`);
    }

    const cardio = cardioByWorkout.get(workout.id);
    if (cardio) {
      const cardioLine = formatCardioInline({
        activity: cardio.activity,
        durationMinutes: workout.duration_minutes,
        distanceKm: cardio.distance_km,
        avgHeartRate: cardio.avg_heart_rate,
        inclinePercent: cardio.incline_percent,
      }).split('\n').join(', ');
      lines.push(`- ${cardioLine}`);
    }

    const body = lines.length > 0 ? lines.join('\n') : '- (без данных)';

    return `${header}\n${body}`;
  });

  return ['# Дневник тренировок', '', ...sections].join('\n\n');
}

export function registerExport(bot: Telegraf): void {
  bot.command('export', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const workouts = await getAllWorkoutsForExport(userId);

    if (workouts.length === 0) {
      await ctx.reply('📭 Пока нет тренировок для экспорта. Начни с /new_workout');
      return;
    }

    const workoutIds = workouts.map((w) => w.id);
    const [exercises, cardioSessions] = await Promise.all([
      getExercisesForWorkouts(workoutIds),
      getCardioSessionsForWorkouts(workoutIds),
    ]);
    const markdown = buildExportMarkdown(workouts, exercises, cardioSessions);

    if (markdown.length <= TELEGRAM_MESSAGE_LIMIT) {
      await ctx.reply(markdown);
    } else {
      const filename = `gym95-export-${new Date().toISOString().slice(0, 10)}.md`;
      await ctx.replyWithDocument({ source: Buffer.from(markdown, 'utf-8'), filename });
    }
  });
}
