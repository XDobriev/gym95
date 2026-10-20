import { supabase } from './client';

export interface SleepLog {
  sleep_date: string; // YYYY-MM-DD — утро, когда проснулся
  hours: number;
}

// Одна запись на утро: повторный ввод за ту же дату перезаписывает значение.
export async function upsertSleep(userId: number, sleepDate: string, hours: number): Promise<void> {
  const { error } = await supabase
    .from('sleep_logs')
    .upsert({ user_id: userId, sleep_date: sleepDate, hours }, { onConflict: 'user_id,sleep_date' });
  if (error) throw new Error(`upsertSleep: ${error.message}`);
}

export async function getSleepSince(userId: number, sinceDate: string): Promise<SleepLog[]> {
  const { data, error } = await supabase
    .from('sleep_logs')
    .select('sleep_date, hours')
    .eq('user_id', userId)
    .gte('sleep_date', sinceDate)
    .order('sleep_date', { ascending: true });
  if (error) throw new Error(`getSleepSince: ${error.message}`);
  return ((data ?? []) as { sleep_date: string; hours: number | string }[]).map((r) => ({
    sleep_date: r.sleep_date,
    hours: Number(r.hours),
  }));
}
