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

// bot.launch() резолвится только когда бот остановлен (long polling блокирует promise
// до вызова bot.stop()), поэтому подтверждение старта делаем через onLaunch-колбэк.
bot.launch(() => {
  console.log(`gym95 bot запущен (long polling) как @${bot.botInfo?.username}`);
}).catch((err) => {
  console.error('Не удалось запустить бота:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
