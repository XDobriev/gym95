import { supabase } from './client';
import { Exercise, SetEntry } from '../types/domain';

export async function addExercise(params: {
  workoutId: string;
  name: string;
  sets: SetEntry[];
  orderIndex: number;
}): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      workout_id: params.workoutId,
      name: params.name,
      sets: params.sets,
      order_index: params.orderIndex,
    })
    .select()
    .single();

  if (error) throw new Error(`addExercise: ${error.message}`);
  return data as Exercise;
}

export async function getExercisesByWorkoutId(workoutId: string): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select()
    .eq('workout_id', workoutId)
    .order('order_index', { ascending: true });

  if (error) throw new Error(`getExercisesByWorkoutId: ${error.message}`);
  return (data ?? []) as Exercise[];
}

export async function getExercisesForWorkouts(workoutIds: string[]): Promise<Exercise[]> {
  if (workoutIds.length === 0) return [];

  const { data, error } = await supabase
    .from('exercises')
    .select()
    .in('workout_id', workoutIds)
    .order('order_index', { ascending: true });

  if (error) throw new Error(`getExercisesForWorkouts: ${error.message}`);
  return (data ?? []) as Exercise[];
}

// Последние уникальные названия упражнений пользователя, отсортированные по недавности использования.
export async function getLastExercisesByUser(userId: number, limit: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('name, workouts!inner(user_id, date)')
    .eq('workouts.user_id', userId)
    .order('date', { foreignTable: 'workouts', ascending: false })
    .limit(50);

  if (error) throw new Error(`getLastExercisesByUser: ${error.message}`);

  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of (data ?? []) as { name: string }[]) {
    if (!seen.has(row.name)) {
      seen.add(row.name);
      names.push(row.name);
    }
    if (names.length >= limit) break;
  }
  return names;
}

// Хронологическая история подходов по конкретному названию упражнения.
export async function getExerciseHistory(
  userId: number,
  exerciseName: string
): Promise<{ date: string; sets: SetEntry[] }[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('sets, workouts!inner(user_id, date)')
    .eq('workouts.user_id', userId)
    .eq('name', exerciseName)
    .order('date', { foreignTable: 'workouts', ascending: true });

  if (error) throw new Error(`getExerciseHistory: ${error.message}`);

  return ((data ?? []) as unknown as { sets: SetEntry[]; workouts: { date: string }[] }[]).map((row) => ({
    date: row.workouts[0].date,
    sets: row.sets,
  }));
}
