import { supabase } from './client';

export async function addWater(userId: number, drunkOn: string, ml: number): Promise<void> {
  const { error } = await supabase.from('water_logs').insert({ user_id: userId, drunk_on: drunkOn, ml });
  if (error) throw new Error(`addWater: ${error.message}`);
}

// Отменить последнюю запись за день. false — нечего отменять.
export async function undoLastWater(userId: number, drunkOn: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('water_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('drunk_on', drunkOn)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`undoLastWater: ${error.message}`);
  if (!data) return false;
  const { error: delError } = await supabase.from('water_logs').delete().eq('id', (data as { id: string }).id);
  if (delError) throw new Error(`undoLastWater/delete: ${delError.message}`);
  return true;
}

export async function getWaterForDay(userId: number, drunkOn: string): Promise<number> {
  const { data, error } = await supabase.from('water_logs').select('ml').eq('user_id', userId).eq('drunk_on', drunkOn);
  if (error) throw new Error(`getWaterForDay: ${error.message}`);
  return ((data ?? []) as { ml: number }[]).reduce((s, r) => s + Number(r.ml), 0);
}
