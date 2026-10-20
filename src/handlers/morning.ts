import { Context, Markup, Telegraf } from 'telegraf';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import { getModules } from '../db/modules';
import { getWorkoutsBetween } from '../db/workouts';
import { getExercisesForWorkouts } from '../db/exercises';
import { getCardioSessionsForWorkouts } from '../db/cardio';
import { listTemplates } from '../db/templates';
import { getUserTimezone } from '../db/profiles';
import { getChainInfo } from '../modules/activity';
import { addDays, localMidnightUtc, localNow } from '../utils/time';
import { formatCardioInline, formatSetsInline, formatWorkoutTypeWithEmoji } from '../utils/format';
import { clearBodyInput, setBodyInput } from './body/state';
import { buildToday, todayKeyboard } from './today';
import { handleNewWorkoutForDate } from './workout';
import { startFoodForDate } from './food';
import { foodYesterdayLine } from '../modules/food';

export type Send = (text: string, extra?: ExtraReplyMessage) => Promise<unknown>;

type MorningStep = 'sleep' | 'weight';

interface MorningSession {
  today: string;
  yesterday: string;
  steps: MorningStep[];
}

const sessions = new Map<number, MorningSession>();

function longDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

async function yesterdayReview(
  userId: number,
  tz: string,
  yesterday: string,
  today: string,
  withFood: boolean
): Promise<string> {
  const workouts = await getWorkoutsBetween(
    userId,
    localMidnightUtc(yesterday, tz).toISOString(),
    localMidnightUtc(today, tz).toISOString()
  );
  const lines = [`☀️ Доброе утро! Сначала — вчера, ${longDate(yesterday)}:`, ''];

  if (workouts.length === 0) {
    lines.push('🏋️ Тренировок не было');
  } else {
    const ids = workouts.map((w) => w.id);
    const [exercises, cardio, templates] = await Promise.all([
      getExercisesForWorkouts(ids),
      getCardioSessionsForWorkouts(ids),
      listTemplates(userId),
    ]);
    for (const w of workouts) {
      const tpl = templates.find((t) => t.id === w.template_id);
      lines.push(tpl ? `🏋️ ${tpl.name}` : formatWorkoutTypeWithEmoji(w.type));
      const c = cardio.find((s) => s.workout_id === w.id);
      if (c) {
        const cardioText = formatCardioInline({
          activity: c.activity,
          durationMinutes: w.duration_minutes,
          distanceKm: c.distance_km,
          avgHeartRate: c.avg_heart_rate,
          inclinePercent: c.incline_percent,
        });
        lines.push(`   ${cardioText.split('\n').join(' · ')}`);
      }
      exercises
        .filter((e) => e.workout_id === w.id)
        .sort((a, b) => a.order_index - b.order_index)
        .forEach((e) => lines.push(`   ${e.name}: ${formatSetsInline(e.sets)}`));
    }
  }

  if (withFood) lines.push(await foodYesterdayLine(userId, yesterday));

  const chain = await getChainInfo(userId).catch(() => null);
  if (chain) lines.push(`🔗 Цепочка: ${chain.current} / ${chain.goal}`);

  lines.push('', 'Всё верно? Если что-то не записал — добавь сейчас.');
  return lines.join('\n');
}

function reviewKeyboard(withFood: boolean) {
  const rows = [
    [Markup.button.callback('✅ Всё верно', 'm:ok')],
    [Markup.button.callback('➕ Тренировка за вчера', 'm:addw')],
  ];
  if (withFood) rows.push([Markup.button.callback('🍽 Еда за вчера', 'm:food')]);
  return Markup.inlineKeyboard(rows).reply_markup;
}

const skipKeyboard = () => Markup.inlineKeyboard([[Markup.button.callback('Пропустить', 'm:skip')]]).reply_markup;

// Утренний обзор: «вчера» → сон → вес. Вызывается кроном или командой /morning.
export async function startMorning(send: Send, userId: number): Promise<void> {
  const tz = await getUserTimezone(userId);
  const { dateStr: today, weekday } = localNow(tz);
  const yesterday = addDays(today, -1);

  const modules = await getModules(userId);
  const on = (id: string) => modules.some((m) => m.module === id && m.enabled);
  const weightRow = modules.find((m) => m.module === 'weight');
  const weightToday = on('weight') && (weightRow?.settings.frequency !== 'weekly' || weekday === 0);

  const steps: MorningStep[] = [];
  if (on('sleep')) steps.push('sleep');
  if (weightToday) steps.push('weight');

  clearBodyInput(userId);
  sessions.set(userId, { today, yesterday, steps });
  const withFood = on('food');
  await send(await yesterdayReview(userId, tz, yesterday, today, withFood), { reply_markup: reviewKeyboard(withFood) });
}

// Следующий шаг обзора. Вызывается после «Всё верно», «Пропустить» и после ввода значения.
export async function continueMorning(send: Send, userId: number): Promise<void> {
  const session = sessions.get(userId);
  if (!session) return;

  const step = session.steps.shift();
  if (step === 'sleep') {
    setBodyInput(userId, { kind: 'sleep', dateStr: session.today, morning: true });
    await send('😴 Сколько спал этой ночью?\nНапример: 7.5 или 7:40', { reply_markup: skipKeyboard() });
    return;
  }
  if (step === 'weight') {
    setBodyInput(userId, { kind: 'weight', dateStr: null, morning: true });
    await send('⚖️ Вес натощак? Например: 130.4', { reply_markup: skipKeyboard() });
    return;
  }

  sessions.delete(userId);
  await send(`Готово, хорошего дня 💪\n\n${await buildToday(userId)}`, { reply_markup: todayKeyboard() });
}

export function isInMorning(userId: number): boolean {
  return sessions.has(userId);
}

const ctxSend = (ctx: Context): Send => (text, extra) => ctx.reply(text, extra);

async function dropKeyboard(ctx: Context): Promise<void> {
  await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
}

export function registerMorning(bot: Telegraf): void {
  bot.command('morning', async (ctx) => {
    await startMorning(ctxSend(ctx), ctx.from.id);
  });

  bot.action('m:ok', async (ctx) => {
    await ctx.answerCbQuery();
    if (!sessions.has(ctx.from.id)) return;
    await dropKeyboard(ctx);
    await continueMorning(ctxSend(ctx), ctx.from.id);
  });

  bot.action('m:skip', async (ctx) => {
    await ctx.answerCbQuery('Пропущено');
    clearBodyInput(ctx.from.id);
    await dropKeyboard(ctx);
    await continueMorning(ctxSend(ctx), ctx.from.id);
  });

  bot.action('m:food', async (ctx) => {
    await ctx.answerCbQuery();
    const session = sessions.get(ctx.from.id);
    const yesterday = session?.yesterday ?? addDays(localNow(await getUserTimezone(ctx.from.id)).dateStr, -1);
    await startFoodForDate(ctx, ctx.from.id, yesterday);
  });

  bot.action('m:addw', async (ctx) => {
    await ctx.answerCbQuery();
    const session = sessions.get(ctx.from.id);
    const yesterday = session?.yesterday ?? addDays(localNow(await getUserTimezone(ctx.from.id)).dateStr, -1);
    await ctx.reply('Записываем тренировку за вчера. Когда сохранишь — нажми «✅ Всё верно» в обзоре выше.');
    await handleNewWorkoutForDate(ctx, yesterday);
  });
}
