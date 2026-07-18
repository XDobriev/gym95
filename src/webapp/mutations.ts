import { getWorkoutOwned, updateWorkoutFields, deleteWorkout } from '../db/workouts';
import { replaceWorkoutExercises } from '../db/exercises';
import { replaceWorkoutCardio } from '../db/cardio';
import { NormalizedWorkoutInput } from './validateWorkout';

export type MutationResult = { ok: true } | { ok: false; status: number; error: string };

// PUT /api/workout/:id — заменяет поля тренировки и весь её состав (упражнения,
// кардио). Владельца проверяем первым делом; операции идут последовательно через
// общий db-слой (тот же, что использует бот).
export async function updateWorkout(
  userId: number,
  workoutId: string,
  input: NormalizedWorkoutInput
): Promise<MutationResult> {
  const owner = await getWorkoutOwned(userId, workoutId);
  if (!owner) return { ok: false, status: 404, error: 'Тренировка не найдена' };

  await updateWorkoutFields(userId, workoutId, input.fields);
  await replaceWorkoutExercises(workoutId, input.exercises);
  await replaceWorkoutCardio(workoutId, input.cardio);

  return { ok: true };
}

// DELETE /api/workout/:id. Повторное удаление уже удалённой (двойной тап) —
// тоже 404, но вызывающий на фронте это просто игнорирует.
export async function deleteWorkoutForUser(userId: number, workoutId: string): Promise<MutationResult> {
  const existed = await deleteWorkout(userId, workoutId);
  if (!existed) return { ok: false, status: 404, error: 'Тренировка не найдена' };
  return { ok: true };
}
