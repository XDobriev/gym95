import { createServer } from 'http';
import { bot } from './botInstance';
import { startReminderCron } from './cron/reminders';

// bot.launch() резолвится только когда бот остановлен (long polling блокирует promise
// до вызова bot.stop()), поэтому подтверждение старта делаем через onLaunch-колбэк.
bot.launch(() => {
  console.log(`gym95 bot запущен (long polling) как @${bot.botInfo?.username}`);
  startReminderCron(bot);
}).catch((err) => {
  console.error('Не удалось запустить бота:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Render (и похожие PaaS с бесплатным тарифом для Web Service) держат процесс живым,
// только пока он слушает $PORT и отвечает на HTTP — сам бот работает через long polling
// и HTTP не использует, этот сервер нужен исключительно для health-check пинга.
const port = process.env.PORT;
if (port) {
  createServer((_req, res) => res.writeHead(200).end('ok')).listen(port, () => {
    console.log(`Health-check сервер слушает порт ${port}`);
  });
}
