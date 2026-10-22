import { Telegraf } from 'telegraf';
import { formatPlatesSummary } from '../utils/plates';

export function registerPlates(bot: Telegraf): void {
  // Команды /calc и /plates для быстрого расчета штанги и разминки
  bot.command(['calc', 'plates'], async (ctx) => {
    const text = ctx.message.text.trim();
    const parts = text.split(/\s+/);

    if (parts.length < 2) {
      await ctx.reply(
        '🧮 *Калькулятор блинов и разминки*\n\nНапиши вес штанги через пробел:\n`/calc 85` или `/plates 100`\n\nБот покажет раскладку блинов на гриф (20 кг) и схему разминочных подходов.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const weightKg = parseFloat(parts[1].replace(',', '.'));
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
      await ctx.reply('Введи корректный вес от 20 до 500 кг, например: `/calc 82.5`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const summary = formatPlatesSummary(weightKg, 20);
    await ctx.reply(summary, { parse_mode: 'Markdown' });
  });

  // Действие по кнопке подходов
  bot.action(/^calc:wt:(\d+(?:\.\d+)?)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const weightKg = parseFloat(ctx.match[1]);
    const summary = formatPlatesSummary(weightKg, 20);
    await ctx.reply(summary, { parse_mode: 'Markdown' });
  });
}
