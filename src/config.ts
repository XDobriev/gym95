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
};
