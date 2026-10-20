import { Context, Markup, Telegraf } from 'telegraf';
import { getModules, patchModuleSettings } from '../db/modules';
import { waterSettingsOf } from '../modules/water';
import { formatLitersShort, parseLiters, parseReminderTimes, WORKOUT_BONUS_ML } from '../utils/water';
import { otherActiveFlow, activeFlowBlockedMessage } from './activeFlow';
import {
  clearAwaitingSettingsInput,
  isWaitingForWaterNorm,
  isWaitingForWaterTimes,
  setWaitingForWaterNorm,
  setWaitingForWaterTimes,
} from './settingsState';

async function showWater(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const { baseMl, times } = waterSettingsOf((await getModules(userId)).find((r) => r.module === 'water'));
  const text =
    `💧 Вода\n\nНорма: ${formatLitersShort(baseMl)} л в день (+${formatLitersShort(WORKOUT_BONUS_ML)} л в день тренировки)\n` +
    `Напоминания: ${times.join(', ')}\n\nНапоминание не приходит, если норма уже набрана.`;
  const reply_markup = Markup.inlineKeyboard([
    [Markup.button.callback('🎯 Изменить норму', 's:wa:norm')],
    [Markup.button.callback('⏰ Изменить время напоминаний', 's:wa:times')],
    [Markup.button.callback('⬅️ Назад', 's:menu')],
  ]).reply_markup;
  if (viaEdit) await ctx.editMessageText(text, { reply_markup });
  else await ctx.reply(text, { reply_markup });
}

async function startInput(ctx: Context, userId: number, kind: 'norm' | 'times'): Promise<void> {
  const conflict = otherActiveFlow(userId, 'settings');
  if (conflict) {
    await ctx.reply(activeFlowBlockedMessage(conflict));
    return;
  }
  if (kind === 'norm') {
    setWaitingForWaterNorm(userId);
    await ctx.reply('Сколько литров в день? Например: 2.5 (от 1 до 5)');
  } else {
    setWaitingForWaterTimes(userId);
    await ctx.reply('Во сколько напоминать? Времена через пробел или запятую, например: 10:00 13:00 16:00 19:00');
  }
}

export function registerSettingsWater(bot: Telegraf): void {
  bot.action('s:water', async (ctx) => {
    await ctx.answerCbQuery();
    await showWater(ctx, ctx.from.id, true);
  });

  bot.action('s:wa:norm', async (ctx) => {
    await ctx.answerCbQuery();
    await startInput(ctx, ctx.from.id, 'norm');
  });

  bot.action('s:wa:times', async (ctx) => {
    await ctx.answerCbQuery();
    await startInput(ctx, ctx.from.id, 'times');
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    if (isWaitingForWaterNorm(userId)) {
      const ml = parseLiters(text);
      if (ml === null) {
        await ctx.reply('Нужно число литров от 1 до 5, например 2.5.');
        return;
      }
      clearAwaitingSettingsInput(userId);
      await patchModuleSettings(userId, 'water', { dailyMl: ml });
      await ctx.reply(`✅ Норма воды: ${formatLitersShort(ml)} л.`);
      await showWater(ctx, userId, false);
      return;
    }

    if (isWaitingForWaterTimes(userId)) {
      const times = parseReminderTimes(text);
      if (!times) {
        await ctx.reply('Не понял. Пришли времена как ЧЧ:ММ через пробел, например: 10:00 14:00 18:00 (до 8 штук).');
        return;
      }
      clearAwaitingSettingsInput(userId);
      await patchModuleSettings(userId, 'water', { reminderTimes: times });
      await ctx.reply(`✅ Напоминания о воде: ${times.join(', ')}.`);
      await showWater(ctx, userId, false);
      return;
    }

    return next();
  });
}
