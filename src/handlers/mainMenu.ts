import { Context, Markup, Telegraf } from 'telegraf';
import { sendToday } from './today';
import { handleNewWorkoutCommand } from './workout';
import { resolveWebAppUrl } from './webapp';
import { sendWaterStatus } from './water';
import { sendFoodSummary } from './food';
import { sendBodySummary } from './body';
import { showAchievements } from './achievements';
import { showSettingsMenu } from './settings';
import { platesPresetKeyboard } from './plates';

export function mainMenuReplyKeyboard() {
  return Markup.keyboard([
    ['🏋️ Тренировка', '💧 Вода', '🥗 Еда'],
    ['⚖️ Вес', '🧮 Блины', '📖 Дневник'],
    ['🎯 Сегодня', '🏆 Достижения', '⚙️ Настройки'],
  ]).resize();
}

export function registerMainMenu(bot: Telegraf): void {
  // Быстрое меню из нижних кнопок
  bot.hears('🏋️ Тренировка', async (ctx) => {
    await handleNewWorkoutCommand(ctx);
  });

  bot.hears('💧 Вода', async (ctx) => {
    await sendWaterStatus(ctx, ctx.from.id);
  });

  bot.hears('🥗 Еда', async (ctx) => {
    await sendFoodSummary(ctx, ctx.from.id);
  });

  bot.hears('⚖️ Вес', async (ctx) => {
    await sendBodySummary(ctx, ctx.from.id);
  });

  bot.hears('🧮 Блины', async (ctx) => {
    await ctx.reply(
      '🧮 *Калькулятор блинов на штангу*\n\nВыбери популярный вес или напиши свой:\nНапример: `/calc 82.5` или `/calc 85 15` (гриф 15 кг)',
      {
        parse_mode: 'Markdown',
        reply_markup: platesPresetKeyboard(),
      }
    );
  });

  bot.hears('📖 Дневник', async (ctx) => {
    const url = resolveWebAppUrl();
    if (!url) {
      await ctx.reply('Мини-приложение пока не настроено.');
      return;
    }
    await ctx.reply('Открой визуальный дневник тренировок и графики 👇', {
      reply_markup: Markup.inlineKeyboard([[Markup.button.webApp('📖 Открыть дневник (Mini App)', url)]]).reply_markup,
    });
  });

  bot.hears('🎯 Сегодня', async (ctx) => {
    await sendToday(ctx, ctx.from.id);
  });

  bot.hears('🏆 Достижения', async (ctx) => {
    await showAchievements(ctx, ctx.from.id);
  });

  bot.hears('⚙️ Настройки', async (ctx) => {
    await showSettingsMenu(ctx);
  });
}
