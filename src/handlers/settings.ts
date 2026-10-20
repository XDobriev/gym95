import { Telegraf, Markup, Context } from 'telegraf';
import { getSettings, upsertSettings, UserSettings } from '../db/settings';
import { getUserTimezone } from '../db/profiles';
import { pluralizeRu } from '../utils/format';
import { tzLabel } from '../utils/timezones';
import { otherActiveFlow, activeFlowBlockedMessage } from './activeFlow';
import {
  isWaitingForTime,
  isWaitingForGoal,
  setWaitingForTime,
  setWaitingForGoal,
  clearAwaitingSettingsInput,
} from './settingsState';
import { registerSettingsProfile } from './settingsProfile';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const GOAL_REGEX = /^[1-7]$/;

const MENU_TEXT = '⚙️ Настройки';

function settingsText(s: UserSettings, tz: string): string {
  const status = s.reminders_enabled ? 'включены' : 'выключены';
  const time = s.reminder_time ?? 'не задано';
  const goalWord = pluralizeRu(s.week_goal, ['тренировка', 'тренировки', 'тренировок']);
  return `🏋️ Тренировки\n\nНапоминания: ${status}\nВремя проверки: ${time} (${tzLabel(tz)})\nЦель недели: ${s.week_goal} ${goalWord}`;
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
    [Markup.button.callback('⬅️ Назад', 's:menu')],
  ]).reply_markup;
}

function menuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👤 Профиль', 's:profile')],
    [Markup.button.callback('🏋️ Тренировки', 's:workouts')],
  ]).reply_markup;
}

async function showWorkoutSettings(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const [settings, tz] = await Promise.all([getSettings(userId), getUserTimezone(userId)]);
  const opts = { reply_markup: settingsKeyboard(settings) };
  if (viaEdit) await ctx.editMessageText(settingsText(settings, tz), opts);
  else await ctx.reply(settingsText(settings, tz), opts);
}

export function registerSettings(bot: Telegraf): void {
  registerSettingsProfile(bot);

  bot.command('settings', async (ctx) => {
    clearAwaitingSettingsInput(ctx.from.id);
    await ctx.reply(MENU_TEXT, { reply_markup: menuKeyboard() });
  });

  bot.action('s:menu', async (ctx) => {
    await ctx.answerCbQuery();
    clearAwaitingSettingsInput(ctx.from.id);
    await ctx.editMessageText(MENU_TEXT, { reply_markup: menuKeyboard() });
  });

  bot.action('s:workouts', async (ctx) => {
    await ctx.answerCbQuery();
    await showWorkoutSettings(ctx, ctx.from.id, true);
  });

  bot.action('s:reminders:on', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    await upsertSettings(userId, { reminders_enabled: true });
    await showWorkoutSettings(ctx, userId, true);
  });

  bot.action('s:reminders:off', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    await upsertSettings(userId, { reminders_enabled: false });
    await showWorkoutSettings(ctx, userId, true);
  });

  bot.action('s:time', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const conflict = otherActiveFlow(userId, 'settings');
    if (conflict) {
      await ctx.reply(activeFlowBlockedMessage(conflict));
      return;
    }

    setWaitingForTime(userId);
    await ctx.reply('Напиши время в формате ЧЧ:ММ (например, 19:30). Время — по твоему часовому поясу из профиля.');
  });

  bot.action('s:goal', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const conflict = otherActiveFlow(userId, 'settings');
    if (conflict) {
      await ctx.reply(activeFlowBlockedMessage(conflict));
      return;
    }

    setWaitingForGoal(userId);
    await ctx.reply('Сколько тренировок в неделю — цель? Число от 1 до 7.');
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    if (isWaitingForGoal(userId)) {
      const text = 'text' in ctx.message ? ctx.message.text.trim() : '';
      if (!GOAL_REGEX.test(text)) {
        await ctx.reply('Не понял число. Пришли целое от 1 до 7, например 4.');
        return;
      }
      const n = Number(text);

      clearAwaitingSettingsInput(userId);
      await upsertSettings(userId, { week_goal: n });
      const goalWord = pluralizeRu(n, ['тренировка', 'тренировки', 'тренировок']);
      await ctx.reply(`✅ Готово! Цель недели: ${n} ${goalWord}.`);
      await showWorkoutSettings(ctx, userId, false);
      return;
    }

    if (!isWaitingForTime(userId)) {
      return next();
    }

    const text = 'text' in ctx.message ? ctx.message.text.trim() : '';
    if (!TIME_REGEX.test(text)) {
      await ctx.reply('Не понял формат. Пришли время как ЧЧ:ММ, например 07:45.');
      return;
    }

    clearAwaitingSettingsInput(userId);
    await upsertSettings(userId, { reminder_time: text });
    await ctx.reply(`✅ Готово! Время обновлено: ${text}.`);
    await showWorkoutSettings(ctx, userId, false);
  });
}
