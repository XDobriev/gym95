import { supabase } from './client';
import { Workout, WorkoutType } from '../types/domain';

export async function createWorkout(params: {
  userId: number;
  type: WorkoutType;
  date?: Date;
  durationMinutes?: number;
  notes?: string;
  warmupMinutes?: number;
}): Promise<Workout> {
  const { data, error } = await supabase
    .from('workouts')
    .insert({
      user_id: params.userId,
      type: params.type,
      date: (params.date ?? new Date()).toISOString(),
      duration_minutes: params.durationMinutes ?? null,
      notes: params.notes ?? null,
      warmup_minutes: params.warmupMinutes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createWorkout: ${error.message}`);
  return data as Workout;
}

export async function getRecentWorkouts(
  userId: number,
  limit: number,
  offset: number
): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select()
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getRecentWorkouts: ${error.message}`);
  return (data ?? []) as Workout[];
}

export async function countWorkouts(userId: number): Promise<number> {
  const { count, error } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw new Error(`countWorkouts: ${error.message}`);
  return count ?? 0;
}

export async function getAllWorkoutsForExport(userId: number): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select()
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) throw new Error(`getAllWorkoutsForExport: ${error.message}`);
  return (data ?? []) as Workout[];
}
