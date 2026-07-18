import { supabase } from './client';
import { Exercise, SetEntry } from '../types/domain';
import { getWorkoutOwned } from './workouts';

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

// Полностью заменяет состав упражнений тренировки (для PUT из Mini App): сносит
// старые строки и вставляет новые с последовательным order_index. Владельца
// тренировки вызывающий обязан проверить заранее (getWorkoutOwned).
// Не транзакционно (как и создание в finish.ts) — на однопользовательском боте
// окно рассинхрона пренебрежимо; вставка идёт одним bulk-запросом.
export async function replaceWorkoutExercises(
  workoutId: string,
  exercises: { name: string; sets: SetEntry[] }[]
): Promise<void> {
  const { error: delError } = await supabase.from('exercises').delete().eq('workout_id', workoutId);
  if (delError) throw new Error(`replaceWorkoutExercises/delete: ${delError.message}`);

  if (exercises.length === 0) return;

  const rows = exercises.map((ex, index) => ({
    workout_id: workoutId,
    name: ex.name,
    sets: ex.sets,
    order_index: index,
  }));
  const { error: insError } = await supabase.from('exercises').insert(rows);
  if (insError) throw new Error(`replaceWorkoutExercises/insert: ${insError.message}`);
}

// Точечная замена подходов одного упражнения (для бота). Owner-проверка через
// родительскую тренировку. false — если тренировка чужая/удалена.
export async function updateExerciseSets(
  userId: number,
  workoutId: string,
  exerciseId: string,
  sets: SetEntry[]
): Promise<boolean> {
  const owner = await getWorkoutOwned(userId, workoutId);
  if (!owner) return false;

  const { error } = await supabase
    .from('exercises')
    .update({ sets })
    .eq('id', exerciseId)
    .eq('workout_id', workoutId);

  if (error) throw new Error(`updateExerciseSets: ${error.message}`);
  return true;
}

// Удаляет одно упражнение из тренировки (для бота). Owner-проверка через
// родительскую тренировку.
export async function deleteExercise(
  userId: number,
  workoutId: string,
  exerciseId: string
): Promise<boolean> {
  const owner = await getWorkoutOwned(userId, workoutId);
  if (!owner) return false;

  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', exerciseId)
    .eq('workout_id', workoutId);

  if (error) throw new Error(`deleteExercise: ${error.message}`);
  return true;
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
