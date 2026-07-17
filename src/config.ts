import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Отсутствует обязательная переменная окружения: ${name}. Проверьте .env (см. .env.example).`);
  }
  return value;
}

export const config = {
  BOT_TOKEN: requireEnv('BOT_TOKEN'),
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_KEY: requireEnv('SUPABASE_KEY'),
  // URL Telegram Mini App (Vercel). Необязателен: если не задан — бот работает
  // как раньше, но кнопка «Дневник» и команда /app не активируются.
  WEBAPP_URL: process.env.WEBAPP_URL ?? '',
};
