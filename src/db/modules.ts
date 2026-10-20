import { supabase } from './client';

export type ModuleId = 'weight' | 'activity' | 'water' | 'food' | 'sleep';

export interface UserModuleRow {
  user_id: number;
  module: ModuleId;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export async function getModules(userId: number): Promise<UserModuleRow[]> {
  const { data, error } = await supabase.from('user_modules').select().eq('user_id', userId);
  if (error) throw new Error(`getModules: ${error.message}`);
  return (data ?? []) as UserModuleRow[];
}

// Строки одного модуля у всех пользователей — для кронов (один запрос в минуту, а не на каждого).
export async function getModuleRowsForAll(module: ModuleId): Promise<UserModuleRow[]> {
  const { data, error } = await supabase.from('user_modules').select().eq('module', module);
  if (error) throw new Error(`getModuleRowsForAll: ${error.message}`);
  return (data ?? []) as UserModuleRow[];
}

export async function upsertModules(rows: UserModuleRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('user_modules').upsert(rows, { onConflict: 'user_id,module' });
  if (error) throw new Error(`upsertModules: ${error.message}`);
}

export async function patchModuleSettings(userId: number, module: ModuleId, patch: Record<string, unknown>): Promise<void> {
  const rows = await getModules(userId);
  const current = rows.find((r) => r.module === module);
  await upsertModules([
    {
      user_id: userId,
      module,
      enabled: current?.enabled ?? false,
      settings: { ...(current?.settings ?? {}), ...patch },
    },
  ]);
}
