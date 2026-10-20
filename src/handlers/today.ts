import { Context, Markup, Telegraf } from 'telegraf';
import { getRecentWorkouts, countWorkoutsSince } from '../db/workouts';
import { getSettings } from '../db/settings';
import { getModules } from '../db/modules';
import { getUserTimezone } from '../db/profiles';
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

function todayKeyboard() {
  const url = resolveWebAppUrl();
  const row = [Markup.button.callback('🏋️ Записать тренировку', 't:new_workout')];
  if (url) return Markup.inlineKeyboard([row, [Markup.button.webApp('📊 Дневник', url)]]).reply_markup;
  return Markup.inlineKeyboard([row]).reply_markup;
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
}
