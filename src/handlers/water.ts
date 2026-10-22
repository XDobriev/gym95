import { Context, Markup, Telegraf } from 'telegraf';
import { addWater, undoLastWater } from '../db/water';
import { getUserTimezone } from '../db/profiles';
import { getWaterStatus, waterStatusText } from '../modules/water';
import { localNow } from '../utils/time';

export function waterKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('+250', 'wa:add:250'),
      Markup.button.callback('+500', 'wa:add:500'),
      Markup.button.callback('+750', 'wa:add:750'),
    ],
    [Markup.button.callback('↩️ Отменить последнее', 'wa:undo')],
  ]).reply_markup;
}

export async function statusFor(userId: number): Promise<string> {
  const tz = await getUserTimezone(userId);
  return waterStatusText(await getWaterStatus(userId, tz, localNow(tz).dateStr));
}

export async function sendWaterStatus(ctx: Context, userId: number): Promise<void> {
  await ctx.reply(await statusFor(userId), { reply_markup: waterKeyboard() });
}

async function refresh(ctx: Context, userId: number): Promise<void> {
  await ctx.editMessageText(await statusFor(userId), { reply_markup: waterKeyboard() }).catch(() => undefined);
}

export function registerWater(bot: Telegraf): void {
  bot.command('water', async (ctx) => {
    await sendWaterStatus(ctx, ctx.from.id);
  });

  bot.action(/^wa:add:(250|500|750)$/, async (ctx) => {
    const userId = ctx.from.id;
    const ml = Number(ctx.match[1]);
    await addWater(userId, localNow(await getUserTimezone(userId)).dateStr, ml);
    await ctx.answerCbQuery(`+${ml} мл`);
    await refresh(ctx, userId);
  });

  bot.action('wa:undo', async (ctx) => {
    const userId = ctx.from.id;
    const ok = await undoLastWater(userId, localNow(await getUserTimezone(userId)).dateStr);
    await ctx.answerCbQuery(ok ? 'Отменено' : 'Сегодня ещё нечего отменять');
    if (ok) await refresh(ctx, userId);
  });
}
