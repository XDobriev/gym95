import { createServer } from 'http';
import { TelegramError } from 'telegraf';
import { bot } from './botInstance';
import { startReminderCron } from './cron/reminders';

const MAX_LAUNCH_ATTEMPTS = 5;
const LAUNCH_RETRY_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// bot.launch() резолвится только когда бот остановлен (long polling блокирует promise
// до вызова bot.stop()), поэтому подтверждение старта делаем через onLaunch-колбэк.
//
// При рестарте контейнера (деплой, пересоздание инстанса на Render) старый процесс
// может ещё держать getUpdates-соединение, пока стартует новый — Telegram в этот
// момент отвечает 409 Conflict. Это транзиентная ситуация, а не фатальная ошибка,
// поэтому ретраим несколько раз вместо мгновенного process.exit(1).
async function launchWithRetry(attempt = 1): Promise<void> {
  try {
    await bot.launch(() => {
      console.log(`gym95 bot запущен (long polling) как @${bot.botInfo?.username}`);
      startReminderCron(bot);
    });
  } catch (err) {
    const isConflict = err instanceof TelegramError && err.code === 409;
    if (isConflict && attempt < MAX_LAUNCH_ATTEMPTS) {
      console.warn(
        `409 Conflict при запуске бота (попытка ${attempt}/${MAX_LAUNCH_ATTEMPTS}), повтор через ${LAUNCH_RETRY_DELAY_MS}мс`
      );
      await sleep(LAUNCH_RETRY_DELAY_MS);
      return launchWithRetry(attempt + 1);
    }
    console.error('Не удалось запустить бота:', err);
    process.exit(1);
  }
}

launchWithRetry();

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
