import { Markup, Telegraf } from 'telegraf';
import { WORKOUT_PROGRAMS, formatProgramDetails } from '../modules/programs';

export function registerPrograms(bot: Telegraf): void {
  bot.command(['programs', 'routines', 'plan'], async (ctx) => {
    const buttons = WORKOUT_PROGRAMS.map((p) => [
      Markup.button.callback(`${p.emoji} ${p.title}`, `prg:view:${p.id}`),
    ]);

    await ctx.reply(
      '📋 *Готовые программы тренировок gym95*\n\nВыбери программу, чтобы посмотреть расписание дней и список упражнений:',
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
      }
    );
  });

  bot.action(/^prg:view:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const programId = ctx.match[1];
    const program = WORKOUT_PROGRAMS.find((p) => p.id === programId);

    if (!program) {
      await ctx.reply('Программа не найдена.');
      return;
    }

    const text = formatProgramDetails(program);
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Все программы', 'prg:all')],
      ]).reply_markup,
    });
  });

  bot.action('prg:all', async (ctx) => {
    await ctx.answerCbQuery();
    const buttons = WORKOUT_PROGRAMS.map((p) => [
      Markup.button.callback(`${p.emoji} ${p.title}`, `prg:view:${p.id}`),
    ]);

    await ctx.editMessageText(
      '📋 *Готовые программы тренировок gym95*\n\nВыбери программу, чтобы посмотреть расписание дней и список упражнений:',
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
      }
    );
  });
}

