import { Telegraf } from 'telegraf';
import { config } from './config';
import { registerStart } from './handlers/start';
import { registerHistory } from './handlers/history';
import { registerProgress } from './handlers/progress';
import { registerExport } from './handlers/export';
import { registerWorkout } from './handlers/workout';

const bot = new Telegraf(config.BOT_TOKEN);

registerStart(bot);
registerWorkout(bot);
registerHistory(bot);
registerProgress(bot);
registerExport(bot);

bot.catch((err, ctx) => {
  console.error(`Ошибка обработки апдейта ${ctx.updateType}:`, err);
});

bot.launch().then(() => {
  console.log('gym95 bot запущен (long polling)');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
