import { Telegraf, Context, Markup } from 'telegraf';
import { getRecentWorkouts, countWorkouts } from '../db/workouts';
import { getExercisesForWorkouts } from '../db/exercises';
import { getCardioSessionsForWorkouts } from '../db/cardio';
import { Workout, Exercise, CardioSession } from '../types/domain';
import { formatCardioInline, formatDateShortRu, formatWorkoutTypeWithEmoji, pluralizeRu } from '../utils/format';

const PAGE_SIZE = 5;

// Текст одной карточки тренировки — переиспользуется и в /history, и при
// возврате из режима правки/удаления к обычному виду карточки.
export function formatWorkoutCardText(
  workout: Workout,
  exercises: Exercise[],
  cardio: CardioSession | undefined
): string {
  const names = exercises.map((ex) => ex.name);

  const parts: string[] = [];
  if (workout.warmup_minutes) {
    parts.push(`🔥 Разминка: ${workout.warmup_minutes} мин`);
  }
  if (names.length > 0) {
    const word = pluralizeRu(names.length, ['упражнение', 'упражнения', 'упражнений']);
    parts.push(`${names.join(', ')} (${names.length} ${word})`);
  }
  if (cardio) {
    parts.push(
      formatCardioInline({
        activity: cardio.activity,
        durationMinutes: workout.duration_minutes,
        distanceKm: cardio.distance_km,
        avgHeartRate: cardio.avg_heart_rate,
        inclinePercent: cardio.incline_percent,
      })
    );
  }
  if (workout.notes) {
    parts.push(`«${workout.notes}»`);
  }

  const summary =
    parts.length > 0 ? parts.join('\n') : workout.duration_minutes ? `${workout.duration_minutes} мин` : '—';

  return `📅 ${formatDateShortRu(workout.date)} — ${formatWorkoutTypeWithEmoji(workout.type)}\n${summary}`;
}

export function workoutCardKeyboard(workoutId: string, offset: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✏️ Изменить', `we:${workoutId}:${offset}`),
      Markup.button.callback('🗑 Удалить', `wd:${workoutId}:${offset}`),
    ],
  ]).reply_markup;
}

function moreKeyboard(offset: number) {
  return Markup.inlineKeyboard([[Markup.button.callback('➡️ Ещё', `h:${offset}`)]]).reply_markup;
}

// Отправляет по одному сообщению-карточке на каждую тренировку страницы.
// Возвращает офсет следующей страницы и есть ли ещё тренировки.
async function sendHistoryPage(
  ctx: Context,
  userId: number,
  offset: number
): Promise<{ nextOffset: number; hasMore: boolean; sentCount: number }> {
  const [workouts, total] = await Promise.all([
    getRecentWorkouts(userId, PAGE_SIZE, offset),
    countWorkouts(userId),
  ]);

  if (workouts.length === 0) {
    return { nextOffset: offset, hasMore: false, sentCount: 0 };
  }

  const workoutIds = workouts.map((w) => w.id);
  const [exercises, cardioSessions] = await Promise.all([
    getExercisesForWorkouts(workoutIds),
    getCardioSessionsForWorkouts(workoutIds),
  ]);
  const cardioByWorkout = new Map(cardioSessions.map((c) => [c.workout_id, c]));

  for (const workout of workouts) {
    const ownExercises = exercises.filter((ex) => ex.workout_id === workout.id);
    const text = formatWorkoutCardText(workout, ownExercises, cardioByWorkout.get(workout.id));
    await ctx.reply(text, { reply_markup: workoutCardKeyboard(workout.id, offset) });
  }

  const nextOffset = offset + workouts.length;
  return { nextOffset, hasMore: nextOffset < total, sentCount: workouts.length };
}

export function registerHistory(bot: Telegraf): void {
  bot.command('history', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const { nextOffset, hasMore, sentCount } = await sendHistoryPage(ctx, userId, 0);
    if (sentCount === 0) {
      await ctx.reply('📭 Пока нет ни одной тренировки. Начни с /new_workout');
      return;
    }
    if (hasMore) {
      await ctx.reply('Показаны последние тренировки.', { reply_markup: moreKeyboard(nextOffset) });
    }
  });

  bot.action(/^h:(\d+)$/, async (ctx: Context & { match: RegExpMatchArray }) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    // Убираем кнопку «Ещё» с текущего сообщения, чтобы повторный тап не плодил дубли.
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    const offset = parseInt(ctx.match[1], 10);
    const { nextOffset, hasMore, sentCount } = await sendHistoryPage(ctx, userId, offset);
    if (sentCount > 0 && hasMore) {
      await ctx.reply('Показаны следующие тренировки.', { reply_markup: moreKeyboard(nextOffset) });
    }
  });
}
