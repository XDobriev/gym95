import { createServer } from 'http';
import { TelegramError } from 'telegraf';
import { bot } from './botInstance';
import { startReminderCron, stopReminderCron } from './cron/reminders';
import { startMorningCron, stopMorningCron } from './cron/morning';
import { startWaterCron, stopWaterCron } from './cron/water';
import { startChainCron, stopChainCron } from './cron/chain';
import { setupWebAppMenuButton, setupBotCommands } from './handlers/webapp';
import { handleRequest } from './webapp/server';

const MAX_LAUNCH_ATTEMPTS = 5;
const LAUNCH_RETRY_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let initialized = false;

function initServicesOnce(): void {
  if (initialized) return;
  initialized = true;
  console.log(`gym95 bot инициализирован (long polling) как @${bot.botInfo?.username}`);
  startReminderCron(bot);
  startMorningCron(bot);
  startWaterCron(bot);
  startChainCron(bot);
  void setupWebAppMenuButton(bot);
  void setupBotCommands(bot);
}

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
      initServicesOnce();
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

const shutdown = (signal: string) => {
  stopReminderCron();
  stopMorningCron();
  stopWaterCron();
  stopChainCron();
  bot.stop(signal);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Render держит процесс живым, только пока он слушает $PORT и отвечает на HTTP.
// Этот же сервер теперь отдаёт Telegram Mini App: статику webapp/dist и /api/*
// (см. src/webapp/server.ts). Health-check (UptimeRobot) бьёт в `/` — отдаётся
// index.html (200) — либо в `/healthz`. Long polling бота от HTTP не зависит.
const port = process.env.PORT;
if (port) {
  createServer(handleRequest).listen(port, () => {
    console.log(`HTTP-сервер (Mini App + health) слушает порт ${port}`);
  });
}
