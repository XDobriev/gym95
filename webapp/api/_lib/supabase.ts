import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Ленивая инициализация: клиент создаётся при первом обращении, чтобы
// отсутствие env не роняло импорт-фазу функции целиком.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}
