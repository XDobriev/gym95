import { bot } from './botInstance';

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
