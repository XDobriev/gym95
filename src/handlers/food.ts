import { Context, Markup, Telegraf } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { addFood, deleteFood, getFoodBetween, getFoodEntry, updateFoodKcal } from '../db/food';
import { getUserTimezone } from '../db/profiles';
import { isModuleEnabled } from '../modules/body';
import { dayTotalLine, entryLabel, foodAverages, frequentDishes, FrequentDish, getKcalNorm } from '../modules/food';
import { addDays, localNow } from '../utils/time';
import { formatKcal, parseFoodLine } from '../utils/food';
import { getDraft } from './workout/state';

const HINT = 'Еду записывай одной строкой: «обед 650», «перекус 2 яблока 190», «вчера ужин 700».';

const ddmm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`;

// Режим «еда за другой день» (из утреннего обзора или кнопки «за вчера»): userId → дата.
const foodDate = new Map<number, string>();
// Ожидание нового значения ккал для записи: userId → id записи.
const foodFix = new Map<number, string>();
// Последний показанный список частых блюд — чтобы кнопка ссылалась на индекс.
const shownDishes = new Map<number, FrequentDish[]>();

async function todayOf(userId: number): Promise<string> {
  return localNow(await getUserTimezone(userId)).dateStr;
}

function entryKeyboard(id: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✏️ Ккал', `fd:fix:${id}`), Markup.button.callback('🗑 Удалить', `fd:del:${id}`)],
  ]).reply_markup;
}

async function recordFood(
  ctx: Context,
  userId: number,
  item: { meal: FrequentDish['meal']; description: string | null; kcal: number },
  dateStr: string
): Promise<void> {
  const today = await todayOf(userId);
  const entry = await addFood({ userId, eatenOn: dateStr, ...item });
  const [dayEntries, norm] = await Promise.all([getFoodBetween(userId, dateStr, dateStr), getKcalNorm(userId)]);
  const dayName = dateStr === today ? 'Сегодня' : `За ${ddmm(dateStr)}`;
  await ctx.reply(`${entryLabel(entry)} · ${formatKcal(entry.kcal)} ккал${dateStr !== today ? ` (за ${ddmm(dateStr)})` : ''}\n${dayName}: ${dayTotalLine(dayEntries, norm)}`, {
    reply_markup: entryKeyboard(entry.id),
  });
}

// Начать ввод еды за конкретный день (утренний обзор → «🍽 Еда за вчера»).
export async function startFoodForDate(ctx: Context, userId: number, dateStr: string): Promise<void> {
  foodDate.set(userId, dateStr);
  const dishes = await frequentDishes(userId, await todayOf(userId));
  shownDishes.set(userId, dishes);
  const rows: InlineKeyboardButton[][] = dishes.map((d, i) => [
    Markup.button.callback(`${d.description} · ${d.kcal}`, `fd:q:${i}`),
  ]);
  rows.push([Markup.button.callback('✅ Готово', 'fd:done')]);
  await ctx.reply(
    `🍽 Еда за ${ddmm(dateStr)}. Пиши по одной строке: «завтрак 450», «обед 650», «перекус 190».\nКогда закончишь — «✅ Готово».`,
    { reply_markup: Markup.inlineKeyboard(rows).reply_markup }
  );
}

async function sendFoodSummary(ctx: Context, userId: number): Promise<void> {
  const today = await todayOf(userId);
  const [entries, norm, avgs, dishes] = await Promise.all([
    getFoodBetween(userId, today, today),
    getKcalNorm(userId),
    foodAverages(userId, today),
    frequentDishes(userId, today),
  ]);
  shownDishes.set(userId, dishes);

  const lines = ['🍽 Еда сегодня', ''];
  if (entries.length === 0) lines.push('Пока ничего не записано.');
  entries.forEach((e, i) => lines.push(`${i + 1}. ${entryLabel(e)} — ${formatKcal(e.kcal)}`));
  lines.push('', `Итого: ${dayTotalLine(entries, norm)}`);
  if (avgs.avg7 !== null) lines.push(`В среднем за 7 дней: ${formatKcal(avgs.avg7)} ккал`);
  if (avgs.avg30 !== null) lines.push(`В среднем за 30 дней: ${formatKcal(avgs.avg30)} ккал`);
  if (norm) lines.push(`Норма (по профилю и весу): ${formatKcal(norm)} ккал`);
  lines.push('', HINT);

  const rows: InlineKeyboardButton[][] = dishes.map((d, i) => [
    Markup.button.callback(`🔁 ${d.description} · ${d.kcal}`, `fd:q:${i}`),
  ]);
  entries.forEach((e, i) => {
    if (i < 8) rows.push([Markup.button.callback(`✏️ ${i + 1}`, `fd:fix:${e.id}`), Markup.button.callback(`🗑 ${i + 1}`, `fd:del:${e.id}`)]);
  });
  rows.push([Markup.button.callback('📅 Еда за вчера', 'fd:yday')]);
  await ctx.reply(lines.join('\n'), { reply_markup: Markup.inlineKeyboard(rows).reply_markup });
}

export function registerFood(bot: Telegraf): void {
  bot.command('food', (ctx) => sendFoodSummary(ctx, ctx.from.id));

  bot.action(/^fd:q:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const dish = shownDishes.get(userId)?.[Number(ctx.match[1])];
    if (!dish) return;
    await recordFood(ctx, userId, dish, foodDate.get(userId) ?? (await todayOf(userId)));
  });

  bot.action('fd:yday', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    await startFoodForDate(ctx, userId, addDays(await todayOf(userId), -1));
  });

  bot.action('fd:done', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const date = foodDate.get(userId);
    foodDate.delete(userId);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    if (!date) return;
    const [entries, norm] = await Promise.all([getFoodBetween(userId, date, date), getKcalNorm(userId)]);
    await ctx.reply(`✅ Еда за ${ddmm(date)}: ${dayTotalLine(entries, norm)}`);
  });

  bot.action(/^fd:fix:([0-9a-f-]{36})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const entry = await getFoodEntry(ctx.from.id, ctx.match[1]);
    if (!entry) {
      await ctx.reply('Эта запись уже удалена.');
      return;
    }
    foodFix.set(ctx.from.id, entry.id);
    await ctx.reply(`${entryLabel(entry)} — сейчас ${entry.kcal} ккал. Сколько на самом деле?`);
  });

  bot.action(/^fd:del:([0-9a-f-]{36})$/, async (ctx) => {
    const ok = await deleteFood(ctx.from.id, ctx.match[1]);
    await ctx.answerCbQuery(ok ? 'Удалено' : 'Уже удалено');
    if (ok) await ctx.reply('🗑 Запись о еде удалена.');
  });

  // Регистрируется самым последним: еда пишется обычным текстом, поэтому берём
  // только то, что не забрал ни один сценарий (тренировка, настройки, вес/сон…).
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      foodFix.delete(userId);
      return next();
    }

    const fixId = foodFix.get(userId);
    if (fixId) {
      const kcal = Number(text);
      if (!Number.isInteger(kcal) || kcal < 20 || kcal > 5000) {
        await ctx.reply('Нужно целое число ккал от 20 до 5000, например 650.');
        return;
      }
      foodFix.delete(userId);
      const ok = await updateFoodKcal(userId, fixId, kcal);
      await ctx.reply(ok ? `✅ Исправлено: ${formatKcal(kcal)} ккал` : 'Эта запись уже удалена.');
      return;
    }

    if (getDraft(userId)) return next(); // идёт запись тренировки — текст не про еду

    const food = parseFoodLine(text);
    if (!food) {
      await ctx.reply(`Не понял 🤔\n${HINT}\nВес — /weight 130.4, сон — /sleep 7.5. Все команды — /start`);
      return;
    }
    if (!(await isModuleEnabled(userId, 'food'))) {
      await ctx.reply('Модуль еды выключен. Включить: /settings → 🧩 Модули.');
      return;
    }
    const today = await todayOf(userId);
    const date = food.yesterday ? addDays(today, -1) : foodDate.get(userId) ?? today;
    await recordFood(ctx, userId, food, date);
  });
}
