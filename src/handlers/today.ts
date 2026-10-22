import { Context, Markup, Telegraf } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { getRecentWorkouts, countWorkoutsSince } from '../db/workouts';
import { getSettings } from '../db/settings';
import { getModules } from '../db/modules';
import { getUserTimezone } from '../db/profiles';
import { addWater } from '../db/water';
import { availableModules } from '../modules/registry';
import { localNow, localWeekStart, localMidnightUtc, daysBetween } from '../utils/time';
import { pluralizeRu } from '../utils/format';
import { resolveWebAppUrl } from './webapp';
import { handleNewWorkoutCommand } from './workout';
import { WorkoutType } from '../types/domain';

const TYPE_LABELS: Record<WorkoutType, string> = {
  strength: 'силовая',
  cardio: 'кардио',
  pool: 'бассейн',
  mixed: 'смешанная',
};

function relativeDay(days: number): string {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days === 2) return 'позавчера';
  return `${days} дн. назад`;
}

async function workoutsBlock(userId: number, tz: string, todayStr: string): Promise<string> {
  const [last] = await getRecentWorkouts(userId, 1, 0);
  const weekStart = localMidnightUtc(localWeekStart(tz), tz).toISOString();
  const [weekCount, settings] = await Promise.all([countWorkoutsSince(userId, weekStart), getSettings(userId)]);

  // «из N» требует родительного падежа: из 1 тренировки, из 3/5 тренировок.
  const goalWord = pluralizeRu(settings.week_goal, ['тренировки', 'тренировок', 'тренировок']);
  const weekLine = `   На этой неделе: ${weekCount} из ${settings.week_goal} ${goalWord}`;
  if (!last) {
    return (
      `🏋️ Тренировок пока нет\n${weekLine}\n\n` +
      'Прошлые тренировки можно записать задним числом: /new_workout → «📅 Другая дата».'
    );
  }

  const lastDay = localNow(tz, new Date(last.date)).dateStr;
  const ago = daysBetween(lastDay, todayStr);
  if (ago === 0) return `🏋️ Сегодня: ${TYPE_LABELS[last.type]} ✓\n${weekLine}`;
  return `🏋️ Сегодня тренировки не было\n   Последняя: ${relativeDay(ago)} · ${TYPE_LABELS[last.type]}\n${weekLine}`;
}

export async function buildToday(userId: number): Promise<string> {
  const tz = await getUserTimezone(userId);
  const now = new Date();
  const { dateStr } = localNow(tz, now);
  const header = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  const blocks = [await workoutsBlock(userId, tz, dateStr)];

  const modules = availableModules();
  if (modules.length > 0) {
    const rows = await getModules(userId);
    for (const m of modules) {
      if (!m.todaySection || !rows.find((r) => r.module === m.id && r.enabled)) continue;
      const section = await m.todaySection(userId, { tz, todayStr: dateStr });
      if (section) blocks.push(section);
    }
  }

  return `Сегодня, ${header}\n\n${blocks.join('\n\n')}`;
}

export function todayKeyboard() {
  const url = resolveWebAppUrl();
  const rows: InlineKeyboardButton[][] = [
    [Markup.button.callback('🏋️ Записать тренировку', 't:new_workout')],
    [
      Markup.button.callback('💧 +250 мл', 't:wa:250'),
      Markup.button.callback('💧 +500 мл', 't:wa:500'),
    ],
    [
      Markup.button.callback('🥗 Записать еду', 't:food'),
      Markup.button.callback('⚖️ Записать вес', 't:weight'),
    ],
  ];
  if (url) {
    rows.push([Markup.button.webApp('📖 Открыть дневник (Mini App)', url)]);
  }
  return Markup.inlineKeyboard(rows).reply_markup;
}

export async function sendToday(ctx: Context, userId: number): Promise<void> {
  await ctx.reply(await buildToday(userId), { reply_markup: todayKeyboard() });
}

export function registerToday(bot: Telegraf): void {
  bot.command('today', async (ctx) => {
    await sendToday(ctx, ctx.from.id);
  });

  bot.action('t:new_workout', async (ctx) => {
    await ctx.answerCbQuery();
    await handleNewWorkoutCommand(ctx);
  });

  bot.action(/^t:wa:(250|500)$/, async (ctx) => {
    const userId = ctx.from.id;
    const ml = Number(ctx.match[1]);
    const tz = await getUserTimezone(userId);
    await addWater(userId, localNow(tz).dateStr, ml);
    await ctx.answerCbQuery(`+${ml} мл воды! 💧`);
    await ctx.editMessageText(await buildToday(userId), { reply_markup: todayKeyboard() }).catch(() => undefined);
  });

  bot.action('t:food', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      '🥗 Напиши, что ты съел — одной строкой:\nНапример: «обед гречка с курицей» или «перекус 2 яблока 190».\nБот автоматически посчитает калории и добавит в дневник.'
    );
  });

  bot.action('t:weight', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('⚖️ Введи свой утренний вес числом, например: `85.4`', { parse_mode: 'Markdown' });
  });
}
