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

// Тренировка по id с проверкой владельца. null — если не найдена или чужая.
// Единственная точка сверки владельца: и удаление, и точечные правки дочерних
// таблиц (exercises/cardio) идут только после успешного вызова этой функции.
export async function getWorkoutOwned(userId: number, workoutId: string): Promise<Workout | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select()
    .eq('id', workoutId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`getWorkoutOwned: ${error.message}`);
  return (data as Workout | null) ?? null;
}

export interface WorkoutFieldsUpdate {
  date?: string; // ISO-строка
  type?: WorkoutType;
  durationMinutes?: number | null;
  warmupMinutes?: number | null;
  notes?: string | null;
}

// Обновляет только переданные поля (undefined-ключи пропускаются, null — очищает).
// Возвращает false, если строки не оказалось (чужая/удалённая) — вызывающий решает,
// показывать ли ошибку.
export async function updateWorkoutFields(
  userId: number,
  workoutId: string,
  fields: WorkoutFieldsUpdate
): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  if (fields.date !== undefined) patch.date = fields.date;
  if (fields.type !== undefined) patch.type = fields.type;
  if (fields.durationMinutes !== undefined) patch.duration_minutes = fields.durationMinutes;
  if (fields.warmupMinutes !== undefined) patch.warmup_minutes = fields.warmupMinutes;
  if (fields.notes !== undefined) patch.notes = fields.notes;

  if (Object.keys(patch).length === 0) return true;

  const { data, error } = await supabase
    .from('workouts')
    .update(patch)
    .eq('id', workoutId)
    .eq('user_id', userId)
    .select('id');

  if (error) throw new Error(`updateWorkoutFields: ${error.message}`);
  return (data ?? []).length > 0;
}

// Удаляет тренировку целиком. Дочерние exercises/cardio_sessions чистятся
// каскадом (ON DELETE CASCADE в схеме). Возвращает false, если удалять было нечего.
export async function deleteWorkout(userId: number, workoutId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)
    .eq('user_id', userId)
    .select('id');

  if (error) throw new Error(`deleteWorkout: ${error.message}`);
  return (data ?? []).length > 0;
}
