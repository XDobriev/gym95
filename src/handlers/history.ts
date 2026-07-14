import { Telegraf, Context, Markup } from 'telegraf';
import { getRecentWorkouts, countWorkouts } from '../db/workouts';
import { getExercisesForWorkouts } from '../db/exercises';
import { getCardioSessionsForWorkouts } from '../db/cardio';
import { formatCardioInline, formatDateShortRu, formatWorkoutTypeWithEmoji } from '../utils/format';

const PAGE_SIZE = 5;

async function renderHistoryPage(userId: number, offset: number): Promise<{ text: string; hasMore: boolean }> {
  const [workouts, total] = await Promise.all([
    getRecentWorkouts(userId, PAGE_SIZE, offset),
    countWorkouts(userId),
  ]);

  if (workouts.length === 0) {
    return { text: 'Пока нет ни одной тренировки. Начни с /new_workout', hasMore: false };
  }

  const workoutIds = workouts.map((w) => w.id);
  const [exercises, cardioSessions] = await Promise.all([
    getExercisesForWorkouts(workoutIds),
    getCardioSessionsForWorkouts(workoutIds),
  ]);
  const cardioByWorkout = new Map(cardioSessions.map((c) => [c.workout_id, c]));

  const blocks = workouts.map((workout) => {
    const names = exercises
      .filter((ex) => ex.workout_id === workout.id)
      .map((ex) => ex.name);
    const cardio = cardioByWorkout.get(workout.id);

    const parts: string[] = [];
    if (names.length > 0) {
      parts.push(`${names.join(', ')} (${names.length} упражнени${names.length === 1 ? 'е' : 'й'})`);
    }
    if (cardio) {
      parts.push(
        formatCardioInline({
          activity: cardio.activity,
          durationMinutes: workout.duration_minutes,
          distanceKm: cardio.distance_km,
          avgHeartRate: cardio.avg_heart_rate,
        })
      );
    }

    const summary =
      parts.length > 0 ? parts.join('\n') : workout.duration_minutes ? `${workout.duration_minutes} мин` : '—';

    return `📅 ${formatDateShortRu(workout.date)} — ${formatWorkoutTypeWithEmoji(workout.type)}\n${summary}`;
  });

  return { text: blocks.join('\n\n'), hasMore: offset + PAGE_SIZE < total };
}

function historyKeyboard(offset: number, hasMore: boolean) {
  if (!hasMore) return undefined;
  return Markup.inlineKeyboard([[Markup.button.callback('➡️ Ещё', `h:${offset + PAGE_SIZE}`)]]).reply_markup;
}

export function registerHistory(bot: Telegraf): void {
  bot.command('history', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const { text, hasMore } = await renderHistoryPage(userId, 0);
    await ctx.reply(text, { reply_markup: historyKeyboard(0, hasMore) });
  });

  bot.action(/^h:(\d+)$/, async (ctx: Context & { match: RegExpMatchArray }) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const offset = parseInt(ctx.match[1], 10);
    const { text, hasMore } = await renderHistoryPage(userId, offset);
    await ctx.editMessageText(text, { reply_markup: historyKeyboard(offset, hasMore) });
  });
}
