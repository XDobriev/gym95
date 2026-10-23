export interface CompletedSet {
  weight: number;
  reps: number;
  completed?: boolean;
}

export interface LiveExerciseItem {
  name: string;
  sets: CompletedSet[];
}

export interface PastExerciseItem {
  name: string;
  sets: { weight: number; reps: number }[];
}

/**
 * Считает суммарный тоннаж сессии (только по выполненным подходам с весом > 0)
 */
export function calculateSessionVolume(exercises: LiveExerciseItem[]): number {
  let volume = 0;
  for (const ex of exercises) {
    for (const set of ex.sets) {
      if (set.completed && set.weight > 0 && set.reps > 0) {
        volume += set.weight * set.reps;
      }
    }
  }
  return volume;
}

/**
 * Исключает упражнения и подходы, которые не были выполнены или имеют 0 повторений
 */
export function filterCompletedExercises(exercises: LiveExerciseItem[]): LiveExerciseItem[] {
  const result: LiveExerciseItem[] = [];
  for (const ex of exercises) {
    const validSets = ex.sets.filter((s) => s.completed && s.reps > 0);
    if (validSets.length > 0) {
      result.push({
        name: ex.name,
        sets: validSets,
      });
    }
  }
  return result;
}

/**
 * Находит предыдущие рабочие веса и повторения для упражнения и номера подхода
 */
export function getGhostValues(
  pastExercises: PastExerciseItem[] | null | undefined,
  exerciseName: string,
  setIndex: number
): { weight: number; reps: number } {
  if (!pastExercises || pastExercises.length === 0) {
    return { weight: 0, reps: 10 };
  }

  const normTarget = exerciseName.trim().toLowerCase();
  const past = pastExercises.find((e) => e.name.trim().toLowerCase() === normTarget);
  if (!past || past.sets.length === 0) {
    return { weight: 0, reps: 10 };
  }

  if (setIndex < past.sets.length) {
    return { weight: past.sets[setIndex].weight, reps: past.sets[setIndex].reps };
  }

  // Если текущий подход за пределами списка прошлых сетов — берём последний подход
  const lastSet = past.sets[past.sets.length - 1];
  return { weight: lastSet.weight, reps: lastSet.reps };
}

/**
 * Расчёт 1RM (одноповторного максимума) по формуле Эпли: вес * (1 + повт/30)
 * Округляется до 0.5 кг.
 */
export function calculateLive1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  const raw = weight * (1 + reps / 30);
  return Math.round(raw * 2) / 2;
}
