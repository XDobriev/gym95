import { supabase } from './client';
import { Goal, Profile, Sex } from '../types/profile';
import { DEFAULT_TZ } from '../utils/time';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, { profile: Profile | null; at: number }>();

export async function getProfile(userId: number): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select().eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return (data as Profile | null) ?? null;
}

// Профиль с кэшем на 5 минут: middleware доступа зовёт это на каждый апдейт.
export async function getProfileCached(userId: number): Promise<Profile | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.profile;
  const profile = await getProfile(userId);
  cache.set(userId, { profile, at: Date.now() });
  return profile;
}

export function invalidateProfile(userId: number): void {
  cache.delete(userId);
}

export async function getUserTimezone(userId: number): Promise<string> {
  return (await getProfileCached(userId))?.timezone ?? DEFAULT_TZ;
}

export async function getTimezones(userIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabase.from('profiles').select('user_id, timezone').in('user_id', userIds);
  if (error) throw new Error(`getTimezones: ${error.message}`);
  for (const row of (data ?? []) as { user_id: number; timezone: string }[]) map.set(row.user_id, row.timezone);
  return map;
}

export interface NewProfileInput {
  userId: number;
  inviteCode: string | null;
  goal: Goal;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  timezone: string;
  weightKg: number;
}

export type CreateProfileResult = 'created' | 'invite_invalid' | 'already_exists';

export async function createProfileWithInvite(input: NewProfileInput): Promise<CreateProfileResult> {
  const { error } = await supabase.rpc('redeem_invite_and_create_profile', {
    p_user_id: input.userId,
    p_invite_code: input.inviteCode,
    p_goal: input.goal,
    p_sex: input.sex,
    p_birth_year: input.birthYear,
    p_height_cm: input.heightCm,
    p_timezone: input.timezone,
    p_weight_kg: input.weightKg,
  });
  invalidateProfile(input.userId);
  if (!error) return 'created';
  if (error.message.includes('invite_invalid')) return 'invite_invalid';
  if (error.code === '23505') return 'already_exists';
  throw new Error(`createProfileWithInvite: ${error.message}`);
}

export async function updateProfile(
  userId: number,
  patch: Partial<Pick<Profile, 'goal' | 'sex' | 'birth_year' | 'height_cm' | 'timezone'>>
): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(patch).eq('user_id', userId).select().single();
  invalidateProfile(userId);
  if (error) throw new Error(`updateProfile: ${error.message}`);
  return data as Profile;
}

export async function addBodyWeight(userId: number, weightKg: number): Promise<void> {
  const { error } = await supabase.from('body_weights').insert({ user_id: userId, weight_kg: weightKg });
  if (error) throw new Error(`addBodyWeight: ${error.message}`);
}

export async function getLatestWeight(userId: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('body_weights')
    .select('weight_kg')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestWeight: ${error.message}`);
  return data ? Number((data as { weight_kg: number | string }).weight_kg) : null;
}
