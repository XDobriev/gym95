import { Markup, Telegraf } from 'telegraf';
import { formatPlatesSummary } from '../utils/plates';

export function platesKeyboard(targetWeightKg: number, currentBarWeightKg: number) {
  const bars = [20, 15, 10];
  return Markup.inlineKeyboard([
    bars.map((b) =>
      Markup.button.callback(
        `${b === currentBarWeightKg ? '🔘 ' : ''}${b} кг`,
        `calc:bar:${targetWeightKg}:${b}`
      )
    ),
  ]).reply_markup;
}

export function platesPresetKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('60 кг', 'calc:wt:60'),
      Markup.button.callback('80 кг', 'calc:wt:80'),
      Markup.button.callback('100 кг', 'calc:wt:100'),
      Markup.button.callback('120 кг', 'calc:wt:120'),
    ],
  ]).reply_markup;
}

export function registerPlates(bot: Telegraf): void {
  // Команды /calc и /plates для быстрого расчета штанги и разминки
  bot.command(['calc', 'plates'], async (ctx) => {
    const text = ctx.message.text.trim();
    const parts = text.split(/\s+/);

    if (parts.length < 2) {
      await ctx.reply(
        '🧮 *Калькулятор блинов и разминки*\n\nНапиши вес штанги через пробел:\n`/calc 85` или `/calc 85 15` (если гриф 15 кг)\n\nБот покажет точную раскладку блинов на гриф и пирамиду разминочных подходов.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const weightKg = parseFloat(parts[1].replace(',', '.'));
    let barWeightKg = 20;
    if (parts.length >= 3) {
      const parsedBar = parseFloat(parts[2].replace(',', '.'));
      if (Number.isFinite(parsedBar) && parsedBar > 0 && parsedBar < 50) {
        barWeightKg = parsedBar;
      }
    }

    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
      await ctx.reply('Введи корректный вес от 20 до 500 кг, например: `/calc 82.5`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const summary = formatPlatesSummary(weightKg, barWeightKg);
    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      reply_markup: platesKeyboard(weightKg, barWeightKg),
    });
  });

  // Переключение веса грифа по инлайн-кнопкам
  bot.action(/^calc:bar:(\d+(?:\.\d+)?):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const targetWeightKg = parseFloat(ctx.match[1]);
    const barWeightKg = parseInt(ctx.match[2], 10);
    const summary = formatPlatesSummary(targetWeightKg, barWeightKg);
    await ctx.editMessageText(summary, {
      parse_mode: 'Markdown',
      reply_markup: platesKeyboard(targetWeightKg, barWeightKg),
    }).catch(() => undefined);
  });

  // Действие по кнопке подходов
  bot.action(/^calc:wt:(\d+(?:\.\d+)?)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const weightKg = parseFloat(ctx.match[1]);
    const summary = formatPlatesSummary(weightKg, 20);
    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      reply_markup: platesKeyboard(weightKg, 20),
    });
  });
}

