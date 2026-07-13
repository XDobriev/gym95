import { bot } from './botInstance';

interface YandexHttpEvent {
  body: string;
}

export const handler = async (event: YandexHttpEvent, _context: unknown) => {
  try {
    const update = JSON.parse(event.body);
    await bot.handleUpdate(update);
  } catch (err) {
    console.error('Ошибка обработки вебхук-апдейта:', err);
  }

  // Всегда 200, иначе Telegram будет бесконечно ретраить недоставленный апдейт.
  return { statusCode: 200, body: '' };
};
