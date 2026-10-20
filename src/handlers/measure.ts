import { Context, Markup, Telegraf } from 'telegraf';
import { addMeasurements, getLastMeasurements } from '../db/measure';
import { getUserTimezone } from '../db/profiles';
import { localNow } from '../utils/time';
import { parseDayMonth } from '../utils/parse';
import { MEASURE_FIELDS, measureDiffLines, Measurements, parseCm } from '../utils/measure';
import { otherActiveFlow, activeFlowBlockedMessage } from './activeFlow';
import { continueMorning } from './morning';

interface MeasureSession {
  dateStr: string;
  index: number;
  values: Measurements;
  morning: boolean;
}

const sessions = new Map<number, MeasureSession>();

export function isMeasuring(userId: number): boolean {
  return sessions.has(userId);
}

const ddmm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`;

const stepKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('Пропустить этот', 'ms:skip'), Markup.button.callback('❌ Отменить', 'ms:cancel')],
  ]).reply_markup;

async function askCurrent(ctx: Context, s: MeasureSession): Promise<void> {
  const f = MEASURE_FIELDS[s.index];
  await ctx.reply(`${s.index + 1}/${MEASURE_FIELDS.length} · ${f.label}, см\n${f.hint}`, { reply_markup: stepKeyboard() });
}

async function advance(ctx: Context, userId: number): Promise<void> {
  const s = sessions.get(userId);
  if (!s) return;
  s.index++;
  if (s.index < MEASURE_FIELDS.length) {
    await askCurrent(ctx, s);
    return;
  }

  sessions.delete(userId);
  const filled = MEASURE_FIELDS.filter((f) => s.values[f.key] !== undefined && s.values[f.key] !== null);
  if (filled.length === 0) {
    await ctx.reply('Ни одного замера не записано.');
  } else {
    const previous = await getLastMeasurements(userId, s.dateStr);
    await addMeasurements(userId, s.dateStr, s.values);
    const header = `📏 Замеры за ${ddmm(s.dateStr)} сохранены${previous ? ` (сравнение с ${ddmm(previous.measured_on)})` : ''}:`;
    await ctx.reply([header, '', ...measureDiffLines(s.values, previous)].join('\n'));
  }
  if (s.morning) await continueMorning((text, extra) => ctx.reply(text, extra), userId);
}

export async function startMeasure(ctx: Context, userId: number, dateStr: string | null, morning: boolean): Promise<void> {
  const conflict = otherActiveFlow(userId, 'body');
  if (conflict) {
    await ctx.reply(activeFlowBlockedMessage(conflict));
    return;
  }
  const date = dateStr ?? localNow(await getUserTimezone(userId)).dateStr;
  const s: MeasureSession = { dateStr: date, index: 0, values: {}, morning };
  sessions.set(userId, s);
  await ctx.reply(
    `📏 Замеры лентой${dateStr ? ` за ${ddmm(date)}` : ''}: ${MEASURE_FIELDS.length} штук, любой можно пропустить.\n` +
      'Лента плотно, но без утягивания; лучше утром, натощак.'
  );
  await askCurrent(ctx, s);
}

export function registerMeasure(bot: Telegraf): void {
  bot.command('measure', async (ctx) => {
    const userId = ctx.from.id;
    const arg = ctx.message.text.replace(/^\/\w+(@\w+)?/, '').trim();
    let dateStr: string | null = null;
    if (arg) {
      const parsed = parseDayMonth(arg, localNow(await getUserTimezone(userId)).dateStr);
      if (!parsed.ok) {
        await ctx.reply(parsed.error);
        return;
      }
      dateStr = parsed.dateStr;
    }
    await startMeasure(ctx, userId, dateStr, false);
  });

  bot.action('ms:start:m', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await startMeasure(ctx, ctx.from.id, null, true);
  });

  bot.action('ms:skip', async (ctx) => {
    await ctx.answerCbQuery('Пропущено');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await advance(ctx, ctx.from.id);
  });

  bot.action('ms:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const s = sessions.get(ctx.from.id);
    sessions.delete(ctx.from.id);
    await ctx.editMessageText('Замеры отменены, ничего не сохранено.').catch(() => undefined);
    if (s?.morning) await continueMorning((text, extra) => ctx.reply(text, extra), ctx.from.id);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const s = sessions.get(userId);
    if (!s) return next();
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      sessions.delete(userId);
      return next();
    }
    const cm = parseCm(text);
    if (cm === null) {
      await ctx.reply('Напиши число в сантиметрах, например 118 или 38,5. Или нажми «Пропустить этот».');
      return;
    }
    s.values[MEASURE_FIELDS[s.index].key] = cm;
    await advance(ctx, userId);
  });
}
