import { getDraft, clearDraft } from './state';
import { createWorkout } from '../../db/workouts';
import { addExercise } from '../../db/exercises';
import { addCardioSession } from '../../db/cardio';
import { computeAvgPace } from '../../utils/cardio';
import { formatCardioInline, formatSetsInline } from '../../utils/format';

export type FinishResult =
  | { ok: true; text: string }
  | { ok: false; text: string };

export async function saveDraftWorkout(userId: number): Promise<FinishResult> {
  const draft = getDraft(userId);

  const hasExercises = (draft?.exercises.length ?? 0) > 0;
  const hasCardio = draft?.cardio?.durationMinutes !== undefined;

  if (!draft || !draft.type || (!hasExercises && !hasCardio)) {
    clearDraft(userId);
    return { ok: false, text: 'Тренировка без данных не сохранена.' };
  }

  const workout = await createWorkout({
    userId,
    type: draft.type,
    durationMinutes: draft.cardio?.durationMinutes,
    warmupMinutes: draft.warmupMinutes,
  });

  for (const exercise of draft.exercises) {
    await addExercise({
      workoutId: workout.id,
      name: exercise.name,
      sets: exercise.sets,
      orderIndex: exercise.orderIndex,
    });
  }

  if (draft.cardio && draft.cardio.activity && draft.cardio.durationMinutes !== undefined) {
    const avgPace = computeAvgPace(draft.cardio.durationMinutes, draft.cardio.distanceKm ?? null);
    await addCardioSession({
      workoutId: workout.id,
      activity: draft.cardio.activity,
      distanceKm: draft.cardio.distanceKm ?? null,
      avgHeartRate: draft.cardio.avgHeartRate ?? null,
      avgPace,
      inclinePercent: draft.cardio.inclinePercent ?? null,
    });
  }

  const sections: string[] = [];

  if (draft.warmupMinutes !== undefined) {
    sections.push(`🔥 Разминка: ${draft.warmupMinutes} мин`);
  }

  if (draft.exercises.length > 0) {
    sections.push(
      draft.exercises.map((ex) => `- ${ex.name}: ${formatSetsInline(ex.sets)}`).join('\n')
    );
  }

  if (draft.cardio && draft.cardio.activity && draft.cardio.durationMinutes !== undefined) {
    sections.push(
      formatCardioInline({
        activity: draft.cardio.activity,
        durationMinutes: draft.cardio.durationMinutes,
        distanceKm: draft.cardio.distanceKm ?? null,
        avgHeartRate: draft.cardio.avgHeartRate ?? null,
        inclinePercent: draft.cardio.inclinePercent ?? null,
      })
    );
  }

  clearDraft(userId);

  return {
    ok: true,
    text: `✅ Тренировка сохранена!\n\n${sections.join('\n\n')}\n\nПосмотреть историю — /history`,
  };
}
