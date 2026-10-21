import { Context, Markup, Telegraf } from 'telegraf';
import { Goal, GOAL_LABELS, Profile, Sex, SEX_LABELS } from '../types/profile';
import { addBodyWeight, getLatestWeight, getProfile, updateProfile } from '../db/profiles';
import { getModules, patchModuleSettings, upsertModules } from '../db/modules';
import { isKnownTimezone, tzLabel } from '../utils/timezones';
import { parseBodyLine } from '../utils/parse';
import { formatLiters, waterNormMl } from '../utils/norms';
import { otherActiveFlow, activeFlowBlockedMessage } from './activeFlow';
import { clearAwaitingSettingsInput, isWaitingForBody, setWaitingForBody } from './settingsState';
import { timezoneKeyboard } from './onboarding';

async function profileText(p: Profile): Promise<string> {
  const weight = await getLatestWeight(p.user_id);
  const age = new Date().getFullYear() - p.birth_year;
  return (
    `👤 Профиль\n\n` +
    `Цель: ${GOAL_LABELS[p.goal]}\n` +
    `Рост: ${p.height_cm} см · Вес: ${weight ?? '—'} кг · Возраст: ${age}\n` +
    `Пол: ${SEX_LABELS[p.sex]}\n` +
    `Часовой пояс: ${tzLabel(p.timezone)}`
  );
}

function profileKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎯 Цель', 's:p:goal'), Markup.button.callback('📏 Рост, вес, возраст', 's:p:body')],
    [Markup.button.callback('🚻 Пол', 's:p:sex'), Markup.button.callback('🕒 Часовой пояс', 's:p:tz')],
    [Markup.button.callback('⬅️ Назад', 's:menu')],
  ]).reply_markup;
}

async function showProfile(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const p = await getProfile(userId);
  if (!p) return;
  const text = await profileText(p);
  if (viaEdit) await ctx.editMessageText(text, { reply_markup: profileKeyboard() });
  else await ctx.reply(text, { reply_markup: profileKeyboard() });
}

export function registerSettingsProfile(bot: Telegraf): void {
  bot.action('s:profile', async (ctx) => {
    await ctx.answerCbQuery();
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.action('s:p:goal', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Новая цель?', {
      reply_markup: Markup.inlineKeyboard([
        ...(Object.keys(GOAL_LABELS) as Goal[]).map((g) => [Markup.button.callback(GOAL_LABELS[g], `s:p:goal:${g}`)]),
        [Markup.button.callback('⬅️ Назад', 's:profile')],
      ]).reply_markup,
    });
  });

  bot.action(/^s:p:goal:(lose|gain|regular)$/, async (ctx) => {
    await ctx.answerCbQuery('Цель обновлена');
    const newGoal = ctx.match[1] as Goal;
    await updateProfile(ctx.from.id, { goal: newGoal });
    if (newGoal === 'lose') {
      const rows = await getModules(ctx.from.id);
      const updates = [];
      const foodRow = rows.find((r) => r.module === 'food');
      if (!foodRow?.enabled) {
        updates.push({ user_id: ctx.from.id, module: 'food' as const, enabled: true, settings: foodRow?.settings ?? {} });
      }
      const sleepRow = rows.find((r) => r.module === 'sleep');
      if (!sleepRow?.enabled) {
        updates.push({ user_id: ctx.from.id, module: 'sleep' as const, enabled: true, settings: sleepRow?.settings ?? {} });
      }
      if (updates.length > 0) {
        await upsertModules(updates);
      }
    }
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.action('s:p:sex', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Пол?', {
      reply_markup: Markup.inlineKeyboard([
        (Object.keys(SEX_LABELS) as Sex[]).map((s) => Markup.button.callback(SEX_LABELS[s], `s:p:sex:${s}`)),
        [Markup.button.callback('⬅️ Назад', 's:profile')],
      ]).reply_markup,
    });
  });

  bot.action(/^s:p:sex:(male|female)$/, async (ctx) => {
    await ctx.answerCbQuery('Сохранено');
    await updateProfile(ctx.from.id, { sex: ctx.match[1] as Sex });
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.action('s:p:tz', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Твой часовой пояс?', { reply_markup: timezoneKeyboard('s:p:tz:') });
  });

  bot.action(/^s:p:tz:(.+)$/, async (ctx) => {
    const tz = ctx.match[1];
    if (!isKnownTimezone(tz)) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery('Часовой пояс обновлён');
    await updateProfile(ctx.from.id, { timezone: tz });
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.action('s:p:body', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const conflict = otherActiveFlow(userId, 'settings');
    if (conflict) {
      await ctx.reply(activeFlowBlockedMessage(conflict));
      return;
    }
    setWaitingForBody(userId);
    await ctx.reply('Напиши рост, вес и возраст через пробел, например: 182 95 34');
  });

  bot.action(/^s:p:water:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Норма обновлена');
    await patchModuleSettings(ctx.from.id, 'water', { dailyMl: Number(ctx.match[1]) });
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    if (!isWaitingForBody(userId)) return next();

    const parsed = parseBodyLine(ctx.message.text);
    if (!parsed.ok) {
      await ctx.reply(parsed.error);
      return;
    }
    clearAwaitingSettingsInput(userId);

    await updateProfile(userId, { height_cm: parsed.heightCm, birth_year: new Date().getFullYear() - parsed.age });
    await addBodyWeight(userId, parsed.weightKg);

    const rows = await getModules(userId);
    const currentMl = Number(rows.find((r) => r.module === 'water')?.settings.dailyMl ?? 0);
    const newMl = waterNormMl({ heightCm: parsed.heightCm, weightKg: parsed.weightKg });

    if (currentMl !== newMl) {
      await ctx.reply(
        `✅ Сохранено.\n\nПересчитать норму воды? Сейчас ${currentMl ? formatLiters(currentMl) : 'не задана'}, по новым данным — ${formatLiters(newMl)}.`,
        {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да, пересчитать', `s:p:water:${newMl}`)],
            [Markup.button.callback('Нет, оставить', 's:profile')],
          ]).reply_markup,
        }
      );
      return;
    }
    await ctx.reply('✅ Сохранено.');
    await showProfile(ctx, userId, false);
  });
}
