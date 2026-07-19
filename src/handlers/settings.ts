import { Telegraf, Markup } from 'telegraf';
import { getSettings, upsertSettings, UserSettings } from '../db/settings';
import { pluralizeRu } from '../utils/format';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const GOAL_REGEX = /^[1-7]$/;
const waitingForTime = new Set<number>();
const waitingForGoal = new Set<number>();

function settingsText(s: UserSettings): string {
  const status = s.reminders_enabled ? 'включены' : 'выключены';
  const time = s.reminder_time ?? 'не задано';
  const goalWord = pluralizeRu(s.week_goal, ['тренировка', 'тренировки', 'тренировок']);
  return `⚙️ Настройки\n\nНапоминания: ${status}\nВремя проверки: ${time} (Europe/Moscow)\nЦель недели: ${s.week_goal} ${goalWord}`;
}

function settingsKeyboard(s: UserSettings) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        s.reminders_enabled ? '🔕 Выключить напоминания' : '🔔 Включить напоминания',
        s.reminders_enabled ? 's:reminders:off' : 's:reminders:on'
      ),
    ],
    [Markup.button.callback('⏰ Изменить время', 's:time')],
    [Markup.button.callback('🎯 Изменить цель', 's:goal')],
  ]).reply_markup;
}

export function registerSettings(bot: Telegraf): void {
  bot.command('settings', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    waitingForTime.delete(userId);
    waitingForGoal.delete(userId);
    const settings = await getSettings(userId);
    await ctx.reply(settingsText(settings), { reply_markup: settingsKeyboard(settings) });
  });

  bot.action('s:reminders:on', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const settings = await upsertSettings(userId, { reminders_enabled: true });
    await ctx.editMessageText(settingsText(settings), { reply_markup: settingsKeyboard(settings) });
  });

  bot.action('s:reminders:off', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const settings = await upsertSettings(userId, { reminders_enabled: false });
    await ctx.editMessageText(settingsText(settings), { reply_markup: settingsKeyboard(settings) });
  });

  bot.action('s:time', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    waitingForGoal.delete(userId);
    waitingForTime.add(userId);
    await ctx.reply('Напиши время в формате ЧЧ:ММ (например, 19:30). Часовой пояс — Europe/Moscow.');
  });

  bot.action('s:goal', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    waitingForTime.delete(userId);
    waitingForGoal.add(userId);
    await ctx.reply('Сколько тренировок в неделю — цель? Число от 1 до 7.');
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    if (waitingForGoal.has(userId)) {
      const text = 'text' in ctx.message ? ctx.message.text.trim() : '';
      if (!GOAL_REGEX.test(text)) {
        await ctx.reply('Не понял число. Пришли целое от 1 до 7, например 4.');
        return;
      }
      const n = Number(text);

      waitingForGoal.delete(userId);
      const settings = await upsertSettings(userId, { week_goal: n });
      const goalWord = pluralizeRu(n, ['тренировка', 'тренировки', 'тренировок']);
      await ctx.reply(`✅ Готово! Цель недели: ${n} ${goalWord}.`, {
        reply_markup: settingsKeyboard(settings),
      });
      return;
    }

    if (!waitingForTime.has(userId)) {
      return next();
    }

    const text = 'text' in ctx.message ? ctx.message.text.trim() : '';
    if (!TIME_REGEX.test(text)) {
      await ctx.reply('Не понял формат. Пришли время как ЧЧ:ММ, например 07:45.');
      return;
    }

    waitingForTime.delete(userId);
    const settings = await upsertSettings(userId, { reminder_time: text });
    await ctx.reply(`✅ Готово! Время обновлено: ${text} (Europe/Moscow).`, {
      reply_markup: settingsKeyboard(settings),
    });
  });
}
