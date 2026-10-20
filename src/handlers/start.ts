import { Telegraf } from 'telegraf';
import { sendToday } from './today';

const HELP_TEXT = `Команды:
/today — сегодня: что сделано и что осталось
/morning — утренний обзор: вчера → сон → вес (приходит сам в 07:30)
/weight 130.4 — записать вес (за другой день: /weight 131.2 09.10)
/sleep 7.5 — записать сон (за другую ночь: /sleep 7.5 09.10)
/body — вес и сон: сводка и график
/new_workout — начать новую тренировку
/done — завершить и сохранить текущую тренировку
/templates — шаблоны тренировок (фулбади, дом, стадион, свои)
/history — последние тренировки
/progress <упражнение> — история весов/повторений по упражнению
/export — вся история в markdown (удобно вставить в чат с LLM)
/settings — профиль, напоминания, цель недели
/app — открыть дневник (Mini App)`;

// Сюда доходят только пользователи с профилем: остальных перехватывает
// middleware доступа (src/handlers/access.ts) и знакомство.
export function registerStart(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    await ctx.reply(HELP_TEXT);
    await sendToday(ctx, ctx.from.id);
  });
}
