import { Telegraf } from 'telegraf';
import { config } from './config';
import { registerStart } from './handlers/start';
import { registerHistory } from './handlers/history';
import { registerProgress } from './handlers/progress';
import { registerExport } from './handlers/export';
import { registerWorkout } from './handlers/workout';
import { registerSettings } from './handlers/settings';

export const bot = new Telegraf(config.BOT_TOKEN);

registerStart(bot);
registerWorkout(bot);
registerHistory(bot);
registerProgress(bot);
registerExport(bot);
registerSettings(bot);

bot.catch((err, ctx) => {
  console.error(`Ошибка обработки апдейта ${ctx.updateType}:`, err);
});
