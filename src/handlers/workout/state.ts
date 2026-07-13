import { DraftWorkout, WorkoutStep } from '../../types/draft';
import { WorkoutType } from '../../types/domain';

const drafts = new Map<number, DraftWorkout>();

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

setInterval(() => {
  const now = Date.now();
  for (const [userId, draft] of drafts) {
    if (now - draft.startedAt > STALE_DRAFT_MS) {
      drafts.delete(userId);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();
