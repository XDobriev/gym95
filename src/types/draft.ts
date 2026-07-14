import { CardioActivity, WorkoutType } from './domain';

export type WorkoutStep =
  | 'choosing_type'
  | 'entering_warmup'
  | 'choosing_exercise_name'
  | 'choosing_muscle_group'
  | 'choosing_exercise_in_group'
  | 'entering_custom_exercise_name'
  | 'entering_sets'
  | 'exercise_saved_menu'
  | 'choosing_cardio_activity'
  | 'entering_cardio_duration'
  | 'entering_cardio_distance'
  | 'entering_cardio_incline'
  | 'entering_cardio_pulse'
  | 'cardio_saved_menu';

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
  activity?: CardioActivity;
  durationMinutes?: number;
  distanceKm?: number;
  inclinePercent?: number;
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
  groupExerciseNames?: string[];
  warmupMinutes?: number;
  cardio?: DraftCardio;
  startedAt: number;
  chatId: number;
  lastMessageId?: number;
}
