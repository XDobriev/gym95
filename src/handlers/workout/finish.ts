import { getDraft, clearDraft } from './state';
import { createWorkout } from '../../db/workouts';
import { addExercise } from '../../db/exercises';
import { addCardioSession, getCardioHistory } from '../../db/cardio';
import { computeAvgPace } from '../../utils/cardio';
import { formatCardioInline, formatSetsInline } from '../../utils/format';
import { generateCardioSummary } from '../../utils/cardioSummary';
import { getUserTimezone } from '../../db/profiles';
import { localNoonUtc } from '../../utils/time';
import { chainAfterSaveText, getChainInfo } from '../../modules/activity';

export type FinishResult =
  | { ok: true; text: string; workoutId: string; canSaveAsTemplate: boolean }
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
    date: draft.date ? localNoonUtc(draft.date, await getUserTimezone(userId)) : undefined,
    durationMinutes: draft.cardio?.durationMinutes,
    warmupMinutes: draft.warmupMinutes,
    templateId: draft.templateId,
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

  if (draft.date) {
    const [, m, d] = draft.date.split('-');
    sections.push(`📅 Дата: ${d}.${m}`);
  }

  if (draft.warmupMinutes !== undefined) {
    sections.push(`🔥 Разминка: ${draft.warmupMinutes} мин`);
  }

  if (draft.exercises.length > 0) {
    sections.push(
      draft.exercises.map((ex) => `- ${ex.name}: ${formatSetsInline(ex.sets)}`).join('\n')
    );
  }

  if (draft.cardio && draft.cardio.activity && draft.cardio.durationMinutes !== undefined) {
    const cardioHistory = await getCardioHistory(userId).catch(() => []);
    const previousLaps = cardioHistory.reduce((sum, h) => {
      if (h.activity === 'walking' || h.activity === 'running') {
        return sum + (h.distanceKm ? Math.round((h.distanceKm / 0.4) * 10) / 10 : 0);
      }
      return sum;
    }, 0);

    const summary = generateCardioSummary({
      activity: draft.cardio.activity,
      durationMinutes: draft.cardio.durationMinutes,
      distanceKm: draft.cardio.distanceKm ?? null,
      totalPreviousLaps: previousLaps,
    });

    const lines = [
      formatCardioInline({
        activity: draft.cardio.activity,
        durationMinutes: draft.cardio.durationMinutes,
        distanceKm: draft.cardio.distanceKm ?? null,
        avgHeartRate: draft.cardio.avgHeartRate ?? null,
        inclinePercent: draft.cardio.inclinePercent ?? null,
      }),
    ];

    if (summary.avgPace) lines.push(`⚡ Средний темп: ${summary.avgPace}`);
    if (summary.burnedKcal > 0) lines.push(`🔥 Сожжено: ~${summary.burnedKcal} ккал`);
    if (summary.nextBadge) {
      lines.push(`🎖 До ачивки «${summary.nextBadge.title}»: ещё ${summary.nextBadge.lapsLeft} кр`);
    }

    sections.push(lines.join('\n'));
  }

  clearDraft(userId);

  // Цепочка — не критичная часть ответа: если не посчиталась, тренировка всё равно сохранена.
  const chain = await getChainInfo(userId).catch((err) => {
    console.error('getChainInfo после сохранения тренировки:', err);
    return null;
  });
  if (chain) sections.push(chainAfterSaveText(chain));

  const title = draft.templateName ? `✅ Тренировка «${draft.templateName}» сохранена!` : '✅ Тренировка сохранена!';
  return {
    ok: true,
    text: `${title}\n\n${sections.join('\n\n')}\n\nПосмотреть историю — /history`,
    workoutId: workout.id,
    canSaveAsTemplate: !draft.templateId && draft.type !== 'pool',
  };
}
