import { Markup, Telegraf } from 'telegraf';
import { getProfile, getLatestWeight } from '../db/profiles';
import { getKcalNorm } from '../modules/food';
import { formatDietPlanSummary, formatGroceriesList } from '../modules/dietPlan';

export function registerDiet(bot: Telegraf): void {
  bot.command(['diet', 'groceries', 'menu'], async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const [profile, latestWeight, norm] = await Promise.all([
      getProfile(userId).catch(() => null),
      getLatestWeight(userId).catch(() => null),
      getKcalNorm(userId).catch(() => null),
    ]);

    const weightKg = latestWeight ?? 80;
    const goal = profile?.goal ?? 'lose';
    const dailyKcal = norm ?? 2000;

    const text = formatDietPlanSummary(weightKg, dailyKcal, goal);

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Список покупок на неделю', 'diet:groceries')],
        [Markup.button.callback('🍽 Приемы пищи подробно', 'diet:meals')],
      ]).reply_markup,
    });
  });

  bot.action('diet:groceries', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const [profile, latestWeight, norm] = await Promise.all([
      getProfile(userId).catch(() => null),
      getLatestWeight(userId).catch(() => null),
      getKcalNorm(userId).catch(() => null),
    ]);

    const weightKg = latestWeight ?? 80;
    const goal = profile?.goal ?? 'lose';
    const dailyKcal = norm ?? 2000;

    const text = formatGroceriesList(weightKg, dailyKcal, goal);
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад к БЖУ', 'diet:back')],
      ]).reply_markup,
    });
  });

  bot.action('diet:meals', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const [profile, latestWeight, norm] = await Promise.all([
      getProfile(userId).catch(() => null),
      getLatestWeight(userId).catch(() => null),
      getKcalNorm(userId).catch(() => null),
    ]);

    const weightKg = latestWeight ?? 80;
    const goal = profile?.goal ?? 'lose';
    const dailyKcal = norm ?? 2000;

    const text = formatDietPlanSummary(weightKg, dailyKcal, goal);
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  bot.action('diet:back', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const [profile, latestWeight, norm] = await Promise.all([
      getProfile(userId).catch(() => null),
      getLatestWeight(userId).catch(() => null),
      getKcalNorm(userId).catch(() => null),
    ]);

    const weightKg = latestWeight ?? 80;
    const goal = profile?.goal ?? 'lose';
    const dailyKcal = norm ?? 2000;

    const text = formatDietPlanSummary(weightKg, dailyKcal, goal);
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Список покупок на неделю', 'diet:groceries')],
      ]).reply_markup,
    });
  });
}

