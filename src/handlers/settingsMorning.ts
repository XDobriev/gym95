import { Context, Markup, Telegraf } from 'telegraf';
import { getSettings, upsertSettings } from '../db/settings';
import { getModules, upsertModules, ModuleId } from '../db/modules';
import { getProfile } from '../db/profiles';
import { availableModules, MODULES } from '../modules/registry';
import { otherActiveFlow, activeFlowBlockedMessage } from './activeFlow';
import { clearAwaitingSettingsInput, isWaitingForMorningTime, setWaitingForMorningTime } from './settingsState';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// --- ☀️ Утренний обзор ---

async function showMorning(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const s = await getSettings(userId);
  const text =
    `☀️ Утренний обзор\n\n` +
    `Статус: ${s.morning_enabled ? 'включён' : 'выключен'}\n` +
    `Время: ${s.morning_time}\n\n` +
    'Каждое утро: проверка вчерашнего дня → сон → вес. Запустить вручную — /morning.';
  const reply_markup = Markup.inlineKeyboard([
    [Markup.button.callback(s.morning_enabled ? '🔕 Выключить' : '🔔 Включить', s.morning_enabled ? 's:mo:off' : 's:mo:on')],
    [Markup.button.callback('⏰ Изменить время', 's:mo:time')],
    [Markup.button.callback('⬅️ Назад', 's:menu')],
  ]).reply_markup;
  if (viaEdit) await ctx.editMessageText(text, { reply_markup });
  else await ctx.reply(text, { reply_markup });
}

// --- 🧩 Модули ---

async function showModules(ctx: Context, userId: number): Promise<void> {
  const rows = await getModules(userId);
  const buttons = availableModules().map((m) => {
    const on = rows.some((r) => r.module === m.id && r.enabled);
    return [Markup.button.callback(`${on ? '✅' : '◻️'} ${m.title}`, `s:mod:${m.id}`)];
  });
  buttons.push([Markup.button.callback('⬅️ Назад', 's:menu')]);
  await ctx.editMessageText('🧩 Модули\n\nВыключенный модуль не показывается в /today и не спрашивает в утреннем обзоре.', {
    reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
  });
}

export function registerSettingsMorning(bot: Telegraf): void {
  bot.action('s:morning', async (ctx) => {
    await ctx.answerCbQuery();
    await showMorning(ctx, ctx.from.id, true);
  });

  bot.action(/^s:mo:(on|off)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await upsertSettings(ctx.from.id, { morning_enabled: ctx.match[1] === 'on' });
    await showMorning(ctx, ctx.from.id, true);
  });

  bot.action('s:mo:time', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const conflict = otherActiveFlow(userId, 'settings');
    if (conflict) {
      await ctx.reply(activeFlowBlockedMessage(conflict));
      return;
    }
    setWaitingForMorningTime(userId);
    await ctx.reply('Во сколько присылать утренний обзор? Формат ЧЧ:ММ, например 07:30 (по твоему часовому поясу).');
  });

  bot.action('s:modules', async (ctx) => {
    await ctx.answerCbQuery();
    await showModules(ctx, ctx.from.id);
  });

  bot.action(/^s:mod:(weight|activity|water|food|sleep)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const id = ctx.match[1] as ModuleId;
    const def = MODULES.find((m) => m.id === id);
    if (!def?.available) return;
    const rows = await getModules(userId);
    const row = rows.find((r) => r.module === id);
    const goal = (await getProfile(userId))?.goal ?? 'regular';
    const enabled = !(row?.enabled ?? false);
    await upsertModules([
      { user_id: userId, module: id, enabled, settings: row?.settings ?? def.defaults[goal].settings },
    ]);
    await showModules(ctx, userId);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    if (!isWaitingForMorningTime(userId)) return next();
    const text = ctx.message.text.trim();
    if (!TIME_REGEX.test(text)) {
      await ctx.reply('Не понял формат. Пришли время как ЧЧ:ММ, например 07:30.');
      return;
    }
    clearAwaitingSettingsInput(userId);
    await upsertSettings(userId, { morning_time: text });
    await ctx.reply(`✅ Утренний обзор будет приходить в ${text}.`);
    await showMorning(ctx, userId, false);
  });
}
