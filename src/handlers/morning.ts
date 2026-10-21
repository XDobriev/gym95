import { Context, Markup, Telegraf } from 'telegraf';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import { getModules } from '../db/modules';
import { getWorkoutsBetween } from '../db/workouts';
import { getExercisesForWorkouts } from '../db/exercises';
import { getCardioSessionsForWorkouts } from '../db/cardio';
import { listTemplates } from '../db/templates';
import { getWeightsSince, getUserTimezone } from '../db/profiles';
import { getSleepSince } from '../db/sleep';
import { addWater, undoLastWater } from '../db/water';
import { getWaterStatus } from '../modules/water';
import { getChainInfo } from '../modules/activity';
import { addDays, localMidnightUtc, localNow } from '../utils/time';
import { formatCardioInline, formatSetsInline, formatWorkoutTypeWithEmoji } from '../utils/format';
import { formatLitersShort } from '../utils/water';
import { clearBodyInput, setBodyInput } from './body/state';
import { buildToday, todayKeyboard } from './today';
import { handleNewWorkoutForDate } from './workout';
import { startFoodForDate } from './food';
import { foodYesterdayLine } from '../modules/food';
import { getLastMeasurements } from '../db/measure';
import { MEASURE_INTERVAL_DAYS, measurementDue } from '../utils/measure';

export type Send = (text: string, extra?: ExtraReplyMessage) => Promise<unknown>;

type MorningStep = 'sleep' | 'weight' | 'measure';

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
  withFood: boolean,
  withWater: boolean
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

  if (withWater) {
    try {
      const water = await getWaterStatus(userId, tz, yesterday);
      const done = water.drunkMl >= water.targetMl;
      const drunkStr = formatLitersShort(water.drunkMl);
      const targetStr = formatLitersShort(water.targetMl);
      if (water.drunkMl === 0) {
        lines.push(`💧 Вода вчера: не записана (норма ${targetStr} л)`);
      } else {
        lines.push(`💧 Вода вчера: ${drunkStr} / ${targetStr} л ${done ? '✓ (норма выполнена)' : '⚠️ (не допил)'}`);
      }
    } catch (e) {
      console.error('water yesterday in morning review:', e);
    }
  }

  if (withFood) lines.push(await foodYesterdayLine(userId, yesterday));

  const chain = await getChainInfo(userId).catch(() => null);
  if (chain) lines.push(`🔗 Цепочка: ${chain.current} / ${chain.goal}`);

  lines.push('', 'Всё верно? Если что-то не записал — добавь сейчас.');
  return lines.join('\n');
}

function reviewKeyboard(withFood: boolean, withWater: boolean) {
  const rows = [
    [Markup.button.callback('✅ Всё верно', 'm:ok')],
    [Markup.button.callback('➕ Тренировка за вчера', 'm:addw')],
  ];
  const extras: ReturnType<typeof Markup.button.callback>[] = [];
  if (withWater) extras.push(Markup.button.callback('💧 Вода за вчера', 'm:water'));
  if (withFood) extras.push(Markup.button.callback('🍽 Еда за вчера', 'm:food'));
  if (extras.length > 0) rows.push(extras);
  return Markup.inlineKeyboard(rows).reply_markup;
}

function morningWaterKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('+250 мл', 'm:w:add:250'),
      Markup.button.callback('+500 мл', 'm:w:add:500'),
      Markup.button.callback('+1000 мл', 'm:w:add:1000'),
    ],
    [Markup.button.callback('↩️ Отменить', 'm:w:undo'), Markup.button.callback('⬅️ К обзору', 'm:w:back')],
  ]).reply_markup;
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

  const [existingSleep, existingWeight] = await Promise.all([
    getSleepSince(userId, today),
    getWeightsSince(userId, localMidnightUtc(today, tz).toISOString()),
  ]);

  const steps: MorningStep[] = [];
  if (on('sleep') && existingSleep.length === 0) steps.push('sleep');
  if (weightToday && existingWeight.length === 0) steps.push('weight');

  // Замеры лентой — часть модуля веса: раз в 30 дней после прошлых.
  if (on('weight')) {
    const last = await getLastMeasurements(userId);
    if (measurementDue(last?.measured_on ?? null, today)) steps.push('measure');
  }

  clearBodyInput(userId);
  sessions.set(userId, { today, yesterday, steps });
  const withFood = on('food');
  const withWater = on('water');
  await send(await yesterdayReview(userId, tz, yesterday, today, withFood, withWater), {
    reply_markup: reviewKeyboard(withFood, withWater),
  });
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

  if (step === 'measure') {
    await send(
      `📏 Пора снять замеры лентой — прошло ${MEASURE_INTERVAL_DAYS} дней с прошлых (или их ещё не было).\n6 замеров, пара минут.`,
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('📏 Начать', 'ms:start:m'), Markup.button.callback('Позже', 'm:skip')],
        ]).reply_markup,
      }
    );
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

  bot.action('m:water', async (ctx) => {
    await ctx.answerCbQuery();
    const session = sessions.get(ctx.from.id);
    const tz = await getUserTimezone(ctx.from.id);
    const yesterday = session?.yesterday ?? addDays(localNow(tz).dateStr, -1);
    const water = await getWaterStatus(ctx.from.id, tz, yesterday);
    await ctx.editMessageText(
      `💧 Запись воды за вчера (${longDate(yesterday)}):\nСейчас: ${formatLitersShort(water.drunkMl)} из ${formatLitersShort(water.targetMl)} л\n\nСколько добавить?`,
      { reply_markup: morningWaterKeyboard() }
    ).catch(() => undefined);
  });

  bot.action(/^m:w:add:(250|500|1000)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const ml = Number(ctx.match[1]);
    const session = sessions.get(userId);
    const tz = await getUserTimezone(userId);
    const yesterday = session?.yesterday ?? addDays(localNow(tz).dateStr, -1);
    await addWater(userId, yesterday, ml);
    const water = await getWaterStatus(userId, tz, yesterday);
    await ctx.editMessageText(
      `💧 Добавлено +${ml} мл за вчера!\nСейчас: ${formatLitersShort(water.drunkMl)} из ${formatLitersShort(water.targetMl)} л`,
      { reply_markup: morningWaterKeyboard() }
    ).catch(() => undefined);
  });

  bot.action('m:w:undo', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const session = sessions.get(userId);
    const tz = await getUserTimezone(userId);
    const yesterday = session?.yesterday ?? addDays(localNow(tz).dateStr, -1);
    const ok = await undoLastWater(userId, yesterday);
    const water = await getWaterStatus(userId, tz, yesterday);
    await ctx.editMessageText(
      ok ? `↩️ Последняя запись воды за вчера отменена.\nСейчас: ${formatLitersShort(water.drunkMl)} из ${formatLitersShort(water.targetMl)} л` : 'Нечего отменять за вчера.',
      { reply_markup: morningWaterKeyboard() }
    ).catch(() => undefined);
  });

  bot.action('m:w:back', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const session = sessions.get(userId);
    const tz = await getUserTimezone(userId);
    const { dateStr: today } = localNow(tz);
    const yesterday = session?.yesterday ?? addDays(today, -1);
    const modules = await getModules(userId);
    const on = (id: string) => modules.some((m) => m.module === id && m.enabled);
    const text = await yesterdayReview(userId, tz, yesterday, today, on('food'), on('water'));
    await ctx.editMessageText(text, { reply_markup: reviewKeyboard(on('food'), on('water')) }).catch(() => undefined);
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
