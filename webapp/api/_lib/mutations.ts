// Зеркало src/webapp/mutations.ts бота — то же поведение PUT/DELETE /api/workout/:id,
// но на прямых supabase-запросах (как остальной legacy-путь в _lib/queries.ts),
// а не через src/db/*, из которого webapp не импортирует.
import { getSupabase } from './supabase';
import type { NormalizedWorkoutInput } from './validateWorkout';

export type MutationResult = { ok: true } | { ok: false; status: number; error: string };

async function isOwnedByUser(userId: number, workoutId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workouts')
    .select('id')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`isOwnedByUser: ${error.message}`);
  return data !== null;
}

// PUT /api/workout/:id — заменяет поля тренировки и весь её состав (упражнения,
// кардио). Владельца проверяем первым делом; операции идут последовательно.
export async function updateWorkout(
  userId: number,
  workoutId: string,
  input: NormalizedWorkoutInput
): Promise<MutationResult> {
  const supabase = getSupabase();

  const owned = await isOwnedByUser(userId, workoutId);
  if (!owned) return { ok: false, status: 404, error: 'Тренировка не найдена' };

  const { error: updateError } = await supabase
    .from('workouts')
    .update({
      date: input.fields.date,
      type: input.fields.type,
      duration_minutes: input.fields.durationMinutes,
      warmup_minutes: input.fields.warmupMinutes,
      notes: input.fields.notes,
    })
    .eq('id', workoutId)
    .eq('user_id', userId);
  if (updateError) throw new Error(`updateWorkout: ${updateError.message}`);

  const { error: delExError } = await supabase.from('exercises').delete().eq('workout_id', workoutId);
  if (delExError) throw new Error(`updateWorkout/exercises delete: ${delExError.message}`);
  if (input.exercises.length > 0) {
    const rows = input.exercises.map((ex, index) => ({
      workout_id: workoutId,
      name: ex.name,
      sets: ex.sets,
      order_index: index,
    }));
    const { error: insExError } = await supabase.from('exercises').insert(rows);
    if (insExError) throw new Error(`updateWorkout/exercises insert: ${insExError.message}`);
  }

  const { error: delCardioError } = await supabase.from('cardio_sessions').delete().eq('workout_id', workoutId);
  if (delCardioError) throw new Error(`updateWorkout/cardio delete: ${delCardioError.message}`);
  if (input.cardio.length > 0) {
    const rows = input.cardio.map((c) => ({
      workout_id: workoutId,
      activity: c.activity,
      distance_km: c.distanceKm,
      avg_heart_rate: c.avgHeartRate,
      avg_pace: c.avgPace,
      incline_percent: c.inclinePercent,
    }));
    const { error: insCardioError } = await supabase.from('cardio_sessions').insert(rows);
    if (insCardioError) throw new Error(`updateWorkout/cardio insert: ${insCardioError.message}`);
  }

  return { ok: true };
}

// DELETE /api/workout/:id. Повторное удаление уже удалённой (двойной тап) —
// тоже 404, но вызывающий на фронте это просто игнорирует.
export async function deleteWorkoutForUser(userId: number, workoutId: string): Promise<MutationResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(`deleteWorkoutForUser: ${error.message}`);
  if ((data ?? []).length === 0) return { ok: false, status: 404, error: 'Тренировка не найдена' };
  return { ok: true };
}
