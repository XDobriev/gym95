import { Markup, Telegraf } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { getWorkoutOwned } from '../../db/workouts';
import { getExercisesByWorkoutId } from '../../db/exercises';
import { getCardioSessionsForWorkouts } from '../../db/cardio';
import { createTemplate, deleteOwnTemplate, listTemplates, TemplateType } from '../../db/templates';

const NAME_MAX = 40;

// userId → id тренировки, из которой делаем шаблон (ждём название текстом).
const awaitingName = new Map<number, string>();

export function isAwaitingTemplateName(userId: number): boolean {
  return awaitingName.has(userId);
}

async function templatesText(userId: number): Promise<{ text: string; rows: InlineKeyboardButton[][] }> {
  const all = await listTemplates(userId);
  const builtins = all.filter((t) => t.user_id === null).map((t) => t.name);
  const own = all.filter((t) => t.user_id !== null);

  const lines = ['📋 Шаблоны тренировок', '', `Готовые: ${builtins.join(', ')}`];
  lines.push(own.length ? `Мои: ${own.map((t) => t.name).join(', ')}` : 'Своих пока нет.');
  lines.push(
    '',
    'Свой шаблон: запиши тренировку и нажми «💾 Сохранить как шаблон» под итогом.',
    'Значения в шаблоне каждый раз подставляются из прошлого раза — веса обновлять не нужно.'
  );

  const rows = own.map((t) => [Markup.button.callback(`🗑 Удалить «${t.name}»`, `tpl:del:${t.id}`)]);
  return { text: lines.join('\n'), rows };
}

export function registerTemplateManagement(bot: Telegraf): void {
  bot.command('templates', async (ctx) => {
    const { text, rows } = await templatesText(ctx.from.id);
    await ctx.reply(text, rows.length ? { reply_markup: Markup.inlineKeyboard(rows).reply_markup } : undefined);
  });

  bot.action(/^tpl:del:([0-9a-f-]{36})$/, async (ctx) => {
    const deleted = await deleteOwnTemplate(ctx.from.id, ctx.match[1]);
    await ctx.answerCbQuery(deleted ? 'Шаблон удалён' : 'Шаблон уже удалён');
    const { text, rows } = await templatesText(ctx.from.id);
    await ctx.editMessageText(text, { reply_markup: Markup.inlineKeyboard(rows).reply_markup });
  });

  bot.action(/^tpl:new:([0-9a-f-]{36})$/, async (ctx) => {
    await ctx.answerCbQuery();
    awaitingName.set(ctx.from.id, ctx.match[1]);
    await ctx.reply(`Как назвать шаблон? Например: Фулбади C (до ${NAME_MAX} символов)`);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const workoutId = awaitingName.get(userId);
    if (!workoutId) return next();

    const name = ctx.message.text.trim();
    if (name.startsWith('/')) {
      awaitingName.delete(userId);
      return next();
    }
    if (name.length === 0 || name.length > NAME_MAX) {
      await ctx.reply(`Название — от 1 до ${NAME_MAX} символов. Попробуй ещё раз.`);
      return;
    }
    awaitingName.delete(userId);

    const workout = await getWorkoutOwned(userId, workoutId);
    if (!workout || workout.type === 'pool') {
      await ctx.reply('Не нашёл эту тренировку — возможно, она удалена.');
      return;
    }
    const [exercises, cardioRows] = await Promise.all([
      getExercisesByWorkoutId(workout.id),
      getCardioSessionsForWorkouts([workout.id]),
    ]);
    const c = cardioRows[0];
    await createTemplate({
      userId,
      name,
      type: workout.type as TemplateType,
      exercises: exercises.map((e) => ({ name: e.name, sets: e.sets })),
      cardio: c ? { activity: c.activity, durationMinutes: workout.duration_minutes, distanceKm: c.distance_km } : null,
    });
    await ctx.reply(`✅ Шаблон «${name}» сохранён. Он появится в /new_workout.`);
  });
}
