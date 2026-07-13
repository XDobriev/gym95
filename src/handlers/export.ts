import { Telegraf } from 'telegraf';
import { getAllWorkoutsForExport } from '../db/workouts';
import { getExercisesForWorkouts } from '../db/exercises';
import { Exercise, Workout } from '../types/domain';
import { formatDateIsoDay, formatSetsInline, formatWorkoutTypeRu } from '../utils/format';

const TELEGRAM_MESSAGE_LIMIT = 4096;

function buildExportMarkdown(workouts: Workout[], exercises: Exercise[]): string {
  const exercisesByWorkout = new Map<string, Exercise[]>();
  for (const exercise of exercises) {
    const list = exercisesByWorkout.get(exercise.workout_id) ?? [];
    list.push(exercise);
    exercisesByWorkout.set(exercise.workout_id, list);
  }

  const sections = workouts.map((workout) => {
    const durationSuffix = workout.duration_minutes ? ` (${workout.duration_minutes} мин)` : '';
    const header = `## ${formatDateIsoDay(workout.date)} — ${formatWorkoutTypeRu(workout.type)}${durationSuffix}`;

    const exerciseLines = (exercisesByWorkout.get(workout.id) ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => `- ${ex.name}: ${formatSetsInline(ex.sets)}`);

    const body = exerciseLines.length > 0 ? exerciseLines.join('\n') : '- (без упражнений)';

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
      await ctx.reply('Пока нет тренировок для экспорта. Начни с /new_workout');
      return;
    }

    const exercises = await getExercisesForWorkouts(workouts.map((w) => w.id));
    const markdown = buildExportMarkdown(workouts, exercises);

    if (markdown.length <= TELEGRAM_MESSAGE_LIMIT) {
      await ctx.reply(markdown);
    } else {
      const filename = `gym95-export-${new Date().toISOString().slice(0, 10)}.md`;
      await ctx.replyWithDocument({ source: Buffer.from(markdown, 'utf-8'), filename });
    }
  });
}
