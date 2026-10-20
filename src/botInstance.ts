import { Telegraf } from 'telegraf';
import { config } from './config';
import { registerAccess } from './handlers/access';
import { registerOnboarding } from './handlers/onboarding';
import { registerStart } from './handlers/start';
import { registerToday } from './handlers/today';
import { registerHistory } from './handlers/history';
import { registerProgress } from './handlers/progress';
import { registerExport } from './handlers/export';
import { registerWorkout } from './handlers/workout';
import { registerWorkoutEdit } from './handlers/workout/editStep';
import { registerSettings } from './handlers/settings';
import { registerWebApp } from './handlers/webapp';

export const bot = new Telegraf(config.BOT_TOKEN);

// Порядок важен: доступ — первым, затем знакомство (его текстовый обработчик
// должен видеть текст раньше остальных FSM).
registerAccess(bot);
registerOnboarding(bot);
registerStart(bot);
registerToday(bot);
registerWorkout(bot);
registerWorkoutEdit(bot);
registerHistory(bot);
registerProgress(bot);
registerExport(bot);
registerSettings(bot);
registerWebApp(bot);

const FAILURE_TEXT = '⚠️ Не получилось выполнить действие — сервис может быть временно недоступен. Попробуй через пару минут.';

bot.catch(async (err, ctx) => {
  console.error(`Ошибка обработки апдейта ${ctx.updateType}:`, err);
  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Ошибка, попробуй позже');
    if (ctx.chat) await ctx.reply(FAILURE_TEXT);
  } catch {
    // Telegram тоже недоступен — остаётся только лог.
  }
});
