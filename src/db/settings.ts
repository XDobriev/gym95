import { supabase } from './client';
import { getRecentWorkouts } from './workouts';

export interface UserSettings {
  user_id: number;
  reminders_enabled: boolean;
  reminder_time: string | null;
  last_reminder_sent_date: string | null;
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
  reminders_enabled: false,
  reminder_time: null,
  last_reminder_sent_date: null,
};

export async function getSettings(userId: number): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select()
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`getSettings: ${error.message}`);
  return data ? (data as UserSettings) : { user_id: userId, ...DEFAULT_SETTINGS };
}

export async function upsertSettings(
  userId: number,
  patch: Partial<Omit<UserSettings, 'user_id'>>
): Promise<UserSettings> {
  const current = await getSettings(userId);
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ ...current, ...patch, user_id: userId }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw new Error(`upsertSettings: ${error.message}`);
  return data as UserSettings;
}

export async function getUsersNeedingReminder(
  currentTimeHHMM: string,
  todayDateStr: string,
  minDaysSinceLastWorkout: number
): Promise<number[]> {
  const { data: rows, error } = await supabase
    .from('user_settings')
    .select('user_id, last_reminder_sent_date')
    .eq('reminders_enabled', true)
    .eq('reminder_time', currentTimeHHMM);

  if (error) throw new Error(`getUsersNeedingReminder: ${error.message}`);

  const candidates = (rows ?? []).filter((r) => r.last_reminder_sent_date !== todayDateStr);
  if (candidates.length === 0) return [];

  const checked = await Promise.all(
    candidates.map(async (row) => {
      const last = await getRecentWorkouts(row.user_id, 1, 0);
      if (last.length === 0) return row.user_id;
      // Сырая разница в мс, не календарные дни в MSK — N уже эвристика, не строгий SLA.
      const daysSince = (Date.now() - new Date(last[0].date).getTime()) / 86_400_000;
      return daysSince >= minDaysSinceLastWorkout ? row.user_id : null;
    })
  );

  return checked.filter((id): id is number => id !== null);
}
