import { Telegraf, Markup } from 'telegraf';
import { config } from '../config';

const WEBAPP_BUTTON_TEXT = '📖 Дневник';

// Устанавливает синюю menu-кнопку (слева от поля ввода) как запуск Mini App —
// глобально для всех чатов с ботом. Вызывается на старте, если задан WEBAPP_URL.
export async function setupWebAppMenuButton(bot: Telegraf): Promise<void> {
  if (!config.WEBAPP_URL) return;
  try {
    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: 'web_app',
        text: 'Дневник',
        web_app: { url: config.WEBAPP_URL },
      },
    });
    console.log('Menu-кнопка Mini App установлена');
  } catch (err) {
    console.error('Не удалось установить menu-кнопку Mini App:', err);
  }
}

// Команда /app — присылает кнопку запуска Mini App (дублирует menu-кнопку,
// удобно кинуть ссылку на дневник прямо в переписке).
export function registerWebApp(bot: Telegraf): void {
  bot.command('app', async (ctx) => {
    if (!config.WEBAPP_URL) {
      await ctx.reply('Мини-приложение пока не подключено.');
      return;
    }
    await ctx.reply('Открой свой дневник тренировок 👇', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.webApp(WEBAPP_BUTTON_TEXT, config.WEBAPP_URL)],
      ]).reply_markup,
    });
  });
}
