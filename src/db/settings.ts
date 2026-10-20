import { supabase } from './client';

export interface UserSettings {
  user_id: number;
  reminders_enabled: boolean;
  reminder_time: string | null;
  last_reminder_sent_date: string | null;
  week_goal: number;
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
  reminders_enabled: false,
  reminder_time: null,
  last_reminder_sent_date: null,
  week_goal: 3,
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

export async function getEnabledReminderSettings(): Promise<
  Pick<UserSettings, 'user_id' | 'reminder_time' | 'last_reminder_sent_date'>[]
> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id, reminder_time, last_reminder_sent_date')
    .eq('reminders_enabled', true)
    .not('reminder_time', 'is', null);

  if (error) throw new Error(`getEnabledReminderSettings: ${error.message}`);
  return (data ?? []) as Pick<UserSettings, 'user_id' | 'reminder_time' | 'last_reminder_sent_date'>[];
}
