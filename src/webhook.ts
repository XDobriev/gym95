import { bot } from './botInstance';

interface YandexHttpEvent {
  body: string;
  headers?: Record<string, string>;
}

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  throw new Error(
    'Отсутствует переменная окружения WEBHOOK_SECRET (см. README, раздел "Деплой на Yandex Cloud Functions").',
  );
}

function getSecretTokenHeader(headers: Record<string, string> | undefined): string | undefined {
  if (!headers) return undefined;
  const key = Object.keys(headers).find(
    (name) => name.toLowerCase() === 'x-telegram-bot-api-secret-token',
  );
  return key ? headers[key] : undefined;
}

export const handler = async (event: YandexHttpEvent, _context: unknown) => {
  if (getSecretTokenHeader(event.headers) !== WEBHOOK_SECRET) {
    console.error('Отклонён запрос с неверным или отсутствующим секретным токеном вебхука');
    return { statusCode: 200, body: '' };
  }

  try {
    const update = JSON.parse(event.body);
    await bot.handleUpdate(update);
  } catch (err) {
    console.error('Ошибка обработки вебхук-апдейта:', err);
  }

  // Всегда 200, иначе Telegram будет бесконечно ретраить недоставленный апдейт.
  return { statusCode: 200, body: '' };
};
