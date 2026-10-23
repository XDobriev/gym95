import type { LivePastWorkout } from '../../shared/types';

export interface DraftSet {
  id: string;
  weight: number | '';
  reps: number | '';
  completed: boolean;
}

export interface DraftExercise {
  id: string;
  name: string;
  sets: DraftSet[];
}

export interface ActiveWorkoutDraft {
  startTime: number;
  templateId?: string;
  templateName?: string;
  exercises: DraftExercise[];
  restTimerSeconds?: number;
  restTimerTarget?: number | null; // timestamp когда таймер должен закончиться
}

const DRAFT_STORAGE_KEY = 'gym95_active_workout_draft';

export function calculateSessionVolume(exercises: { sets: { weight: number | ''; reps: number | ''; completed: boolean }[] }[]): number {
  let volume = 0;
  for (const ex of exercises) {
    for (const set of ex.sets) {
      if (set.completed && typeof set.weight === 'number' && set.weight > 0 && typeof set.reps === 'number' && set.reps > 0) {
        volume += set.weight * set.reps;
      }
    }
  }
  return volume;
}

export function calculateLive1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  const raw = weight * (1 + reps / 30);
  return Math.round(raw * 2) / 2;
}

export function getGhostValues(
  pastWorkout: LivePastWorkout | null | undefined,
  exerciseName: string,
  setIndex: number
): { weight: number; reps: number } {
  if (!pastWorkout || !pastWorkout.exercises || pastWorkout.exercises.length === 0) {
    return { weight: 0, reps: 10 };
  }

  const normTarget = exerciseName.trim().toLowerCase();
  const pastEx = pastWorkout.exercises.find((e) => e.name.trim().toLowerCase() === normTarget);
  if (!pastEx || !pastEx.sets || pastEx.sets.length === 0) {
    return { weight: 0, reps: 10 };
  }

  if (setIndex < pastEx.sets.length) {
    return { weight: pastEx.sets[setIndex].weight, reps: pastEx.sets[setIndex].reps };
  }

  const last = pastEx.sets[pastEx.sets.length - 1];
  return { weight: last.weight, reps: last.reps };
}

export function saveWorkoutDraft(draft: ActiveWorkoutDraft): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (err) {
    console.warn('Не удалось сохранить черновик тренировки:', err);
  }
}

export function loadWorkoutDraft(): ActiveWorkoutDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearWorkoutDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
