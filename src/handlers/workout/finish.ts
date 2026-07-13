import { getDraft, clearDraft } from './state';
import { createWorkout } from '../../db/workouts';
import { addExercise } from '../../db/exercises';
import { formatSetsInline } from '../../utils/format';

export type FinishResult =
  | { ok: true; text: string }
  | { ok: false; text: string };

export async function saveDraftWorkout(userId: number): Promise<FinishResult> {
  const draft = getDraft(userId);

  if (!draft || !draft.type || draft.exercises.length === 0) {
    clearDraft(userId);
    return { ok: false, text: 'Тренировка без упражнений не сохранена.' };
  }

  const workout = await createWorkout({ userId, type: draft.type });

  for (const exercise of draft.exercises) {
    await addExercise({
      workoutId: workout.id,
      name: exercise.name,
      sets: exercise.sets,
      orderIndex: exercise.orderIndex,
    });
  }

  const summary = draft.exercises
    .map((ex) => `- ${ex.name}: ${formatSetsInline(ex.sets)}`)
    .join('\n');

  clearDraft(userId);

  return {
    ok: true,
    text: `✅ Тренировка сохранена!\n\n${summary}\n\nПосмотреть историю — /history`,
  };
}
