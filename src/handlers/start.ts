import { Telegraf } from 'telegraf';

const WELCOME_TEXT = `Привет! Это твой дневник тренировок.

Команды:
/new_workout — начать новую тренировку
/done — завершить и сохранить текущую тренировку
/history — последние тренировки
/progress <упражнение> — история весов/повторений по упражнению
/export — вся история в markdown (удобно вставить в чат с LLM)`;

export function registerStart(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    await ctx.reply(WELCOME_TEXT);
  });
}
