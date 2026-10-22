import { Context, Markup, Telegraf } from 'telegraf';
import { addBodyWeight, deleteBodyWeight, getUserTimezone, updateBodyWeight } from '../../db/profiles';
import { upsertSleep } from '../../db/sleep';
import { fmtKg, loadWeightStats, sleepAverage, weightTrendLine } from '../../modules/body';
import { formatDelta, formatHours, parseSleepHours, parseValueWithDate, parseWeightValue } from '../../utils/body';
import { buildWeightChartUrl } from '../../utils/chart';
import { looksLikeFoodDescription, parseFoodLine } from '../../utils/food';
import { getLastMeasurements } from '../../db/measure';
import { measureDiffLines } from '../../utils/measure';
import { localNoonUtc, localNow } from '../../utils/time';
import { otherActiveFlow, activeFlowBlockedMessage } from '../activeFlow';
import { continueMorning, Send } from '../morning';
import { BodyInput, clearBodyInput, getBodyInput, setBodyInput } from './state';

const WEIGHT_HINT = 'Напиши вес числом, например 130.4. За другой день — с датой: 131.2 09.10';
const SLEEP_HINT = 'Напиши, сколько спал: 7.5 или 7:40. За другую ночь — с датой утра: 7.5 09.10';

const ddmm = (dateStr: string) => `${dateStr.slice(8)}.${dateStr.slice(5, 7)}`;
const ctxSend = (ctx: Context): Send => (text, extra) => ctx.reply(text, extra);

function argsOf(ctx: Context): string {
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  return text.replace(/^\/\w+(@\w+)?/, '').trim();
}

async function saveWeight(send: Send, userId: number, kg: number, dateStr: string | null): Promise<void> {
  const tz = await getUserTimezone(userId);
  const id = await addBodyWeight(userId, kg, dateStr ? localNoonUtc(dateStr, tz) : undefined);
  const { stats } = await loadWeightStats(userId, tz);
  const trend = weightTrendLine(stats);
  await send(`⚖️ ${fmtKg(kg)} кг записано${dateStr ? ` за ${ddmm(dateStr)}` : ''}${trend ? `\n${trend}` : ''}`, {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Исправить', `wt:fix:${id}`), Markup.button.callback('🗑 Удалить', `wt:del:${id}`)],
    ]).reply_markup,
  });
}

async function saveSleep(send: Send, userId: number, hours: number, dateStr: string | null): Promise<void> {
  const tz = await getUserTimezone(userId);
  const today = localNow(tz).dateStr;
  const date = dateStr ?? today;
  await upsertSleep(userId, date, hours);
  const { avg7 } = await sleepAverage(userId, today);
  await send(
    `😴 ${formatHours(hours)} — ночь на ${ddmm(date)}` +
      (avg7 !== null ? `\nв среднем за неделю: ${formatHours(avg7)}` : '') +
      '\nИсправить: просто отправь /sleep с новым значением за ту же дату.'
  );
}

// Команды /weight и /sleep: со значением — сразу запись, без — вопрос.
async function handleBodyCommand(ctx: Context, kind: 'weight' | 'sleep'): Promise<void> {
  const userId = ctx.from!.id;
  const args = argsOf(ctx);
  if (!args) {
    const conflict = otherActiveFlow(userId, 'body');
    if (conflict) {
      await ctx.reply(activeFlowBlockedMessage(conflict));
      return;
    }
    setBodyInput(userId, { kind, dateStr: null, morning: false });
    await ctx.reply(kind === 'weight' ? `⚖️ ${WEIGHT_HINT}` : `😴 ${SLEEP_HINT}`);
    return;
  }
  await applyValue(ctxSend(ctx), userId, { kind, dateStr: null, morning: false }, args);
}

// Разбирает «значение [дд.мм]» и сохраняет. false — не распознано (подсказка уже отправлена).
async function applyValue(send: Send, userId: number, input: BodyInput, text: string): Promise<boolean> {
  if (input.kind === 'weightFix') {
    const kg = parseWeightValue(text);
    if (kg === null) {
      await send(WEIGHT_HINT);
      return false;
    }
    const ok = await updateBodyWeight(userId, input.weightId, kg);
    await send(ok ? `✅ Исправлено: ${fmtKg(kg)} кг` : 'Эта запись уже удалена.');
    return true;
  }

  const today = localNow(await getUserTimezone(userId)).dateStr;
  const parsed = parseValueWithDate(text, today);
  if (!parsed.ok) {
    await send(parsed.error);
    return false;
  }
  const dateStr = parsed.dateStr ?? input.dateStr;

  if (input.kind === 'weight') {
    const kg = parseWeightValue(parsed.value);
    if (kg === null) {
      await send(WEIGHT_HINT);
      return false;
    }
    await saveWeight(send, userId, kg, dateStr === today ? null : dateStr);
    return true;
  }

  const hours = parseSleepHours(parsed.value);
  if (hours === null) {
    await send(SLEEP_HINT);
    return false;
  }
  await saveSleep(send, userId, hours, dateStr);
  return true;
}

export async function sendBodySummary(ctx: Context, userId: number): Promise<void> {
  const tz = await getUserTimezone(userId);
  const today = localNow(tz).dateStr;
  const [{ stats, days }, sleep] = await Promise.all([loadWeightStats(userId, tz), sleepAverage(userId, today)]);

  const lines = ['📊 Тело', ''];
  if (stats.latest) {
    lines.push(`⚖️ Последний вес: ${fmtKg(stats.latest.kg)} кг (${ddmm(stats.latest.dateStr)})`);
    if (stats.avg7 !== null) lines.push(`   Среднее за 7 дней: ${fmtKg(stats.avg7)}`);
    if (stats.weekChange !== null) lines.push(`   За неделю: ${formatDelta(stats.weekChange)} кг`);
    if (stats.monthChange !== null) lines.push(`   За месяц: ${formatDelta(stats.monthChange)} кг`);
  } else {
    lines.push('⚖️ Вес ещё не записан — /weight 130.4');
  }
  lines.push(
    sleep.avg7 !== null
      ? `😴 Сон в среднем за неделю: ${formatHours(sleep.avg7)}`
      : '😴 Сна пока мало для среднего — /sleep 7.5'
  );
  const [lastMeasure, prevMeasure] = await Promise.all([
    getLastMeasurements(userId),
    getLastMeasurements(userId).then((m) => (m ? getLastMeasurements(userId, m.measured_on) : null)),
  ]);
  if (lastMeasure) {
    lines.push('', `📏 Замеры ${ddmm(lastMeasure.measured_on)}${prevMeasure ? ` (к ${ddmm(prevMeasure.measured_on)})` : ''}:`);
    measureDiffLines(lastMeasure, prevMeasure).forEach((l) => lines.push(`   ${l}`));
  } else {
    lines.push('', '📏 Замеров пока нет — /measure');
  }
  lines.push('', 'Смотрим на среднее за неделю: вес за день скачет на 0,5–1,5 кг из-за воды и соли.');
  const text = lines.join('\n');

  const CAPTION_LIMIT = 1024; // лимит подписи к фото в Telegram
  if (days.length >= 2 && text.length <= CAPTION_LIMIT) {
    await ctx.replyWithPhoto(buildWeightChartUrl(days), { caption: text });
  } else if (days.length >= 2) {
    await ctx.replyWithPhoto(buildWeightChartUrl(days));
    await ctx.reply(text);
  } else {
    await ctx.reply(text);
  }
}

export function registerBody(bot: Telegraf): void {
  bot.command('weight', (ctx) => handleBodyCommand(ctx, 'weight'));
  bot.command('sleep', (ctx) => handleBodyCommand(ctx, 'sleep'));
  bot.command('body', (ctx) => sendBodySummary(ctx, ctx.from.id));

  bot.action(/^wt:fix:([0-9a-f-]{36})$/, async (ctx) => {
    await ctx.answerCbQuery();
    setBodyInput(ctx.from.id, { kind: 'weightFix', weightId: ctx.match[1] });
    await ctx.reply('Какой вес на самом деле? Например: 130.4');
  });

  bot.action(/^wt:del:([0-9a-f-]{36})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const ok = await deleteBodyWeight(ctx.from.id, ctx.match[1]);
    await ctx.editMessageText('🗑 Запись веса удалена.').catch(() => undefined);
  });

  // Регистрируется последним среди текстовых обработчиков: забирает текст, только
  // если его не взял никакой другой поток (тренировка, правка, настройки…).
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const input = getBodyInput(userId);
    if (!input) return next();

    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      clearBodyInput(userId);
      return next();
    }

    // Висящий вопрос про сон/вес не мешает записать еду: «обед 650» уходит дальше, в модуль еды.
    const isFoodText = parseFoodLine(text) || (looksLikeFoodDescription(text) && !/\d/.test(text));
    if (input.kind !== 'weightFix' && isFoodText) return next();

    const send = ctxSend(ctx);
    if (!(await applyValue(send, userId, input, text))) return;
    clearBodyInput(userId);
    if (input.kind !== 'weightFix' && input.morning) await continueMorning(send, userId);
  });
}
