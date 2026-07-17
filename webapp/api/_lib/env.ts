function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Отсутствует переменная окружения ${name} в проекте Vercel`);
  }
  return value;
}

// Те же значения, что и у бота на Render: задаются в настройках проекта Vercel.
export const env = {
  get BOT_TOKEN() {
    return requireEnv('BOT_TOKEN');
  },
  get SUPABASE_URL() {
    return requireEnv('SUPABASE_URL');
  },
  get SUPABASE_KEY() {
    return requireEnv('SUPABASE_KEY');
  },
};
