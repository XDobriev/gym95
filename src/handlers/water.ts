import { Context, Markup, Telegraf } from 'telegraf';
import { addWater, undoLastWater } from '../db/water';
import { getUserTimezone } from '../db/profiles';
import { getWaterStatus, waterStatusText } from '../modules/water';
import { localNow } from '../utils/time';
import { generateWaterWidgetHtml } from '../templates/waterWidget';
import { sendWidget, editMessageWidgetData, answerWidgetQuery } from '../utils/telegramWidgets';

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

export async function sendWaterOutput(ctx: Context, userId: number): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const tz = await getUserTimezone(userId);
  const status = await getWaterStatus(userId, tz, localNow(tz).dateStr);

  try {
    const html = generateWaterWidgetHtml({
      initialState: {
        drunkMl: status.drunkMl,
        targetMl: status.targetMl,
        workoutBonus: status.workoutBonus,
      },
    });
    await sendWidget(ctx.telegram, {
      chat_id: chatId,
      html,
      chat_data: JSON.stringify({
        drunkMl: status.drunkMl,
        targetMl: status.targetMl,
      }),
    });
    return;
  } catch (err) {
    // Graceful fallback для клиентов без поддержки HTML-виджетов
  }

  await sendWaterStatus(ctx, userId);
}

async function refresh(ctx: Context, userId: number): Promise<void> {
  await ctx.editMessageText(await statusFor(userId), { reply_markup: waterKeyboard() }).catch(() => undefined);
}

export function registerWater(bot: Telegraf): void {
  bot.command('water', async (ctx) => {
    await sendWaterOutput(ctx, ctx.from.id);
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
