import { DraftWorkout, WorkoutStep } from '../../types/draft';
import { WorkoutType } from '../../types/domain';
import {
  ActiveSessionResponse,
  ActiveSessionSetRequest,
  ActiveSessionSetResponse,
} from '../../types/webapp';

const drafts = new Map<number, DraftWorkout>();

// Общий текст полной отмены черновика — озвучивается и при явной отмене
// с верхнего уровня (index.ts), и при отмене кардио-блока в одиночной кардио-тренировке
// (cardioStep.ts), чтобы формулировка не разъезжалась между двумя местами отмены.
export const DRAFT_CANCELLED_TEXT = 'Тренировка отменена — в ней ничего не сохранено. Начни заново — /new_workout';

const STALE_DRAFT_MS = 6 * 60 * 60 * 1000; // 6 часов
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // раз в час

export function getDraft(userId: number): DraftWorkout | undefined {
  return drafts.get(userId);
}

export function startDraft(userId: number, chatId: number): DraftWorkout {
  const draft: DraftWorkout = {
    userId,
    chatId,
    type: null,
    step: 'choosing_type',
    exercises: [],
    startedAt: Date.now(),
  };
  drafts.set(userId, draft);
  return draft;
}

export function clearDraft(userId: number): void {
  drafts.delete(userId);
}

export function setStep(userId: number, step: WorkoutStep): void {
  const draft = drafts.get(userId);
  if (draft) draft.step = step;
}

export function setType(userId: number, type: WorkoutType): void {
  const draft = drafts.get(userId);
  if (draft) draft.type = type;
}

export function setLastMessageId(userId: number, messageId: number): void {
  const draft = drafts.get(userId);
  if (draft) draft.lastMessageId = messageId;
}

// Кнопка "Добавить кардио" доступна только в смешанной тренировке и только пока кардио-блок ещё не сохранён.
export function canAddCardio(draft: DraftWorkout): boolean {
  return draft.type === 'mixed' && !draft.cardio;
}

/**
 * Возвращает состояние активной тренировочной сессии для Mini App (Live Sync).
 */
export function getActiveSession(userId: number): ActiveSessionResponse {
  const draft = drafts.get(userId);
  if (
    !draft ||
    (draft.exercises.length === 0 && !draft.currentExerciseName && !draft.templateId && !draft.widgetMessageId)
  ) {
    return {
      active: false,
      exercises: [],
    };
  }

  let exercises = draft.exercises.map((ex) => ({
    name: ex.name,
    sets: ex.sets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      completed: true,
    })),
  }));

  if (exercises.length === 0 && draft.currentExerciseName) {
    exercises = [
      {
        name: draft.currentExerciseName,
        sets: [],
      },
    ];
  }

  return {
    active: true,
    startedAt: draft.startedAt,
    templateId: draft.templateId,
    templateName: draft.templateName,
    currentExerciseName: draft.currentExerciseName,
    exercises,
    widgetMessageId: draft.widgetMessageId,
    chatId: draft.chatId,
  };
}

/**
 * Записывает подход из Mini App и бесшовно синхронизирует состояние с чат-виджетом.
 */
export async function recordActiveSessionSet(
  userId: number,
  setInput: ActiveSessionSetRequest
): Promise<ActiveSessionSetResponse> {
  let draft = drafts.get(userId);
  if (!draft) {
    draft = {
      userId,
      chatId: userId,
      type: 'strength',
      step: 'entering_sets',
      exercises: [],
      startedAt: Date.now(),
    };
    drafts.set(userId, draft);
  }

  draft.currentExerciseName = setInput.exerciseName;

  let ex = draft.exercises.find((e) => e.name.toLowerCase() === setInput.exerciseName.toLowerCase());
  if (!ex) {
    ex = {
      name: setInput.exerciseName,
      sets: [],
      orderIndex: draft.exercises.length,
    };
    draft.exercises.push(ex);
  }

  const cleanWeight = Math.max(0, Math.round(setInput.weight * 10) / 10);
  const cleanReps = Math.max(1, Math.round(setInput.reps));

  ex.sets.push({
    weight: cleanWeight,
    reps: cleanReps,
  });

  let widgetUpdated = false;

  // Если у тренировки в чате есть активный Live Workout Widget (widgetMessageId)
  if (draft.widgetMessageId && draft.chatId) {
    try {
      const { bot } = await import('../../botInstance');
      const { editMessageWidgetData, serializeWidgetData } = await import('../../utils/telegramWidgets');

      const setIndex = ex.sets.length;
      const targetSets = 4;
      const nextMode = setIndex >= targetSets ? 'done' : 'resting';
      const restDuration = 90;

      if (nextMode === 'done') {
        try {
          const { calculateDoubleProgression } = await import('../../modules/progressionCoach');
          const prog = calculateDoubleProgression(ex.name, ex.sets, { minReps: 8, maxReps: 10 });
          if (prog?.achievedTarget) {
            draft.progressHints = draft.progressHints || {};
            draft.progressHints[ex.name] = prog.recommendedWeight;
          }
        } catch {
          // non-critical coach hint
        }
      }

      const nextState = {
        wid: draft.templateId || `w_${userId}`,
        ex: ex.name,
        sn: setIndex + 1,
        st: targetSets,
        w: cleanWeight,
        r: cleanReps,
        pw: cleanWeight,
        pr: cleanReps,
        m: nextMode as 'active' | 'resting' | 'done',
        rd: restDuration,
        rta: nextMode === 'resting' ? Date.now() + restDuration * 1000 : undefined,
        completedSets: ex.sets.map((s) => ({ w: s.weight, r: s.reps })),
      };

      await editMessageWidgetData(bot.telegram, {
        chat_id: draft.chatId,
        message_id: draft.widgetMessageId,
        chat_data: serializeWidgetData(nextState),
      });
      widgetUpdated = true;
    } catch (err) {
      console.warn('Sync set to Telegram widget failed:', err);
    }
  }

  return {
    ok: true,
    session: getActiveSession(userId),
    widgetUpdated,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, draft] of drafts) {
    if (now - draft.startedAt > STALE_DRAFT_MS) {
      drafts.delete(userId);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();
