import { CardioActivity } from '../../types/domain';

export type EditStep =
  | 'menu'
  | 'awaiting_date'
  | 'awaiting_type'
  | 'awaiting_duration'
  | 'awaiting_warmup'
  | 'awaiting_notes'
  | 'awaiting_exercise_sets'
  | 'awaiting_cardio_distance'
  | 'awaiting_cardio_incline'
  | 'awaiting_cardio_pulse';

export interface CardioEditDraft {
  activity: CardioActivity;
  distanceKm?: number;
  inclinePercent?: number;
  avgHeartRate?: number;
}

export interface EditSession {
  userId: number;
  chatId: number;
  messageId: number;
  workoutId: string;
  offset: number;
  step: EditStep;
  exerciseOrderIndex?: number;
  cardioId?: string;
  cardioDraft?: CardioEditDraft;
  startedAt: number;
}

// Отдельная FSM от drafts (создание тренировки) — правка старой записи и создание
// новой не должны пересекаться по состоянию одного пользователя.
const sessions = new Map<number, EditSession>();

const STALE_SESSION_MS = 30 * 60 * 1000; // правка короче, чем создание тренировки — 30 минут вместо 6 часов
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

export function getEditSession(userId: number): EditSession | undefined {
  return sessions.get(userId);
}

export function startEditSession(params: {
  userId: number;
  chatId: number;
  messageId: number;
  workoutId: string;
  offset: number;
}): EditSession {
  const session: EditSession = { ...params, step: 'menu', startedAt: Date.now() };
  sessions.set(params.userId, session);
  return session;
}

export function clearEditSession(userId: number): void {
  sessions.delete(userId);
}

export function setEditStep(userId: number, step: EditStep): void {
  const session = sessions.get(userId);
  if (session) session.step = step;
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.startedAt > STALE_SESSION_MS) {
      sessions.delete(userId);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();
