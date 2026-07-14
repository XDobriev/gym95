import { supabase } from './client';
import { MuscleGroup } from '../types/domain';

// Дефолтные (общие) упражнения группы + личные добавления пользователя, по алфавиту.
export async function getCatalogByGroup(userId: number, group: MuscleGroup): Promise<string[]> {
  const { data, error } = await supabase
    .from('exercise_catalog')
    .select('name, user_id')
    .eq('muscle_group', group)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('name', { ascending: true });

  if (error) throw new Error(`getCatalogByGroup: ${error.message}`);
  return ((data ?? []) as { name: string; user_id: number | null }[])
    .sort((a, b) => (a.user_id === null ? -1 : 1) - (b.user_id === null ? -1 : 1))
    .map((row) => row.name);
}

// Все личные упражнения пользователя (добавленные вручную), недавние сверху.
export async function getUserCustomExercises(userId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('exercise_catalog')
    .select('name')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getUserCustomExercises: ${error.message}`);
  return ((data ?? []) as { name: string }[]).map((row) => row.name);
}

// Сохраняет введённое вручную название как личное упражнение (без дублей).
export async function addCustomExerciseToCatalog(userId: number, name: string): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from('exercise_catalog')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1);

  if (selectError) throw new Error(`addCustomExerciseToCatalog: ${selectError.message}`);
  if (existing && existing.length > 0) return;

  const { error: insertError } = await supabase
    .from('exercise_catalog')
    .insert({ user_id: userId, name, muscle_group: null });

  if (insertError) throw new Error(`addCustomExerciseToCatalog: ${insertError.message}`);
}
