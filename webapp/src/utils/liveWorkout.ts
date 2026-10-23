import type { LivePastWorkout } from '../../shared/types';

export interface DraftSet {
  id: string;
  weight: number | '';
  reps: number | '';
  completed: boolean;
  rir?: number | null;
}

export interface ExerciseTargetSuggestion {
  targetWeight: number;
  targetReps: number;
  estimated1RM: number;
  reason: string;
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

export function calculateExerciseTarget(
  pastWorkout: LivePastWorkout | null | undefined,
  exerciseName: string
): ExerciseTargetSuggestion | null {
  if (!pastWorkout || !pastWorkout.exercises || pastWorkout.exercises.length === 0) {
    return null;
  }

  const normTarget = exerciseName.trim().toLowerCase();
  const pastEx = pastWorkout.exercises.find((e) => e.name.trim().toLowerCase() === normTarget);
  if (!pastEx || !pastEx.sets || pastEx.sets.length === 0) {
    return null;
  }

  const validSets = pastEx.sets.filter((s) => s.weight > 0 && s.reps > 0);
  if (validSets.length === 0) return null;

  const maxWeight = Math.max(...validSets.map((s) => s.weight));
  const workSets = validSets.filter((s) => s.weight === maxWeight);
  const minWorkReps = Math.min(...workSets.map((s) => s.reps));

  // Если во всех рабочих подходах сделано >= 8 повторений — шаг прогрессии веса!
  if (minWorkReps >= 8) {
    const step = maxWeight < 20 ? 1 : 2.5;
    const targetWeight = Math.round((maxWeight + step) * 10) / 10;
    const targetReps = 8;
    return {
      targetWeight,
      targetReps,
      estimated1RM: calculateLive1RM(targetWeight, targetReps),
      reason: `Двойная прогрессия: в прошлый раз закрыто ${maxWeight} кг × ${minWorkReps}+ повт.!`,
    };
  }

  // Если цель 8 повторений еще не закрыта — закрепляем текущий вес
  const targetReps = Math.min(10, Math.max(8, minWorkReps + 1));
  return {
    targetWeight: maxWeight,
    targetReps,
    estimated1RM: calculateLive1RM(maxWeight, targetReps),
    reason: `Цель: закрыть все подходы на ${targetReps} повт. с весом ${maxWeight} кг`,
  };
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
