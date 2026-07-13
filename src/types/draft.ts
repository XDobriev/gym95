import { WorkoutType } from './domain';

export type WorkoutStep =
  | 'choosing_type'
  | 'choosing_exercise_name'
  | 'entering_custom_exercise_name'
  | 'entering_sets'
  | 'exercise_saved_menu'
  | 'entering_cardio_duration'
  | 'entering_cardio_distance'
  | 'entering_cardio_pulse';

export interface DraftSet {
  weight: number;
  reps: number;
}

export interface DraftExercise {
  name: string;
  sets: DraftSet[];
  orderIndex: number;
}

export interface DraftCardio {
  durationMinutes?: number;
  distanceKm?: number;
  avgHeartRate?: number;
}

export interface DraftWorkout {
  userId: number;
  type: WorkoutType | null;
  step: WorkoutStep;
  exercises: DraftExercise[];
  currentExerciseName?: string;
  appendToLastExercise?: boolean;
  recentExerciseNames?: string[];
  cardio?: DraftCardio;
  startedAt: number;
  chatId: number;
  lastMessageId?: number;
}
