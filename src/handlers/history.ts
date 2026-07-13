import { Telegraf, Context, Markup } from 'telegraf';
import { getRecentWorkouts, countWorkouts } from '../db/workouts';
import { getExercisesForWorkouts } from '../db/exercises';
import { formatDateShortRu, formatWorkoutTypeWithEmoji } from '../utils/format';

const PAGE_SIZE = 5;

async function renderHistoryPage(userId: number, offset: number): Promise<{ text: string; hasMore: boolean }> {
  const [workouts, total] = await Promise.all([
    getRecentWorkouts(userId, PAGE_SIZE, offset),
    countWorkouts(userId),
  ]);

  if (workouts.length === 0) {
    return { text: 'Пока нет ни одной тренировки. Начни с /new_workout', hasMore: false };
  }

  const exercises = await getExercisesForWorkouts(workouts.map((w) => w.id));

  const blocks = workouts.map((workout) => {
    const names = exercises
      .filter((ex) => ex.workout_id === workout.id)
      .map((ex) => ex.name);

    const summary =
      names.length > 0
        ? `${names.join(', ')} (${names.length} упражнени${names.length === 1 ? 'е' : 'й'})`
        : workout.duration_minutes
        ? `${workout.duration_minutes} мин`
        : '—';

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
