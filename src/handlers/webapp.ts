import { Telegraf, Markup } from 'telegraf';
import { config } from '../config';

const WEBAPP_BUTTON_TEXT = '📖 Дневник';

// Эффективный URL Mini App: явный WEBAPP_URL имеет приоритет, иначе — адрес,
// который Render автоматически выдаёт web-сервису (RENDER_EXTERNAL_URL). Так
// Mini App, задеплоенный на том же Render-процессе, подключается без ручного env.
export function resolveWebAppUrl(): string {
  return config.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || '';
}

// Устанавливает синюю menu-кнопку (слева от поля ввода) как запуск Mini App —
// глобально для всех чатов с ботом. Вызывается на старте, если URL известен.
export async function setupWebAppMenuButton(bot: Telegraf): Promise<void> {
  const url = resolveWebAppUrl();
  if (!url) return;
  try {
    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: 'web_app',
        text: 'Дневник',
        web_app: { url },
      },
    });
    console.log(`Menu-кнопка Mini App установлена: ${url}`);
  } catch (err) {
    console.error('Не удалось установить menu-кнопку Mini App:', err);
  }
}

// Регистрирует список команд бота (показывается в меню по «/»). Вызывается на старте.
export async function setupBotCommands(bot: Telegraf): Promise<void> {
  try {
    await bot.telegram.setMyCommands([
      { command: 'today', description: 'Сегодня' },
      { command: 'weight', description: 'Записать вес' },
      { command: 'sleep', description: 'Записать сон' },
      { command: 'food', description: 'Еда: сегодня, средние, частые блюда' },
      { command: 'body', description: 'Вес и сон: сводка и график' },
      { command: 'morning', description: 'Утренний обзор' },
      { command: 'new_workout', description: 'Новая тренировка' },
      { command: 'done', description: 'Завершить и сохранить тренировку' },
      { command: 'templates', description: 'Шаблоны тренировок' },
      { command: 'history', description: 'История тренировок' },
      { command: 'progress', description: 'Прогресс по упражнению' },
      { command: 'app', description: 'Открыть дневник (Mini App)' },
      { command: 'settings', description: 'Профиль и настройки' },
      { command: 'export', description: 'Экспорт истории в markdown' },
    ]);
    console.log('Команды бота зарегистрированы');
  } catch (err) {
    console.error('Не удалось зарегистрировать команды бота:', err);
  }
}

// Команда /app — присылает кнопку запуска Mini App (дублирует menu-кнопку,
// удобно кинуть ссылку на дневник прямо в переписке).
export function registerWebApp(bot: Telegraf): void {
  bot.command('app', async (ctx) => {
    const url = resolveWebAppUrl();
    if (!url) {
      await ctx.reply('Мини-приложение пока не подключено.');
      return;
    }
    await ctx.reply('Открой свой дневник тренировок 👇', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.webApp(WEBAPP_BUTTON_TEXT, url)],
      ]).reply_markup,
    });
  });
}
