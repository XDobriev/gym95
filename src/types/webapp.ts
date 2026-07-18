import { WorkoutType, CardioActivity, SetEntry } from './domain';

// DTO-контракты Mini App API. Должны совпадать по форме с webapp/shared/types.ts
// (фронт десериализует именно это).

export interface ExerciseDTO {
  name: string;
  sets: SetEntry[];
}

export interface CardioDTO {
  activity: CardioActivity;
  distance_km: number | null;
  avg_heart_rate: number | null;
  avg_pace: string | null;
  incline_percent: number | null;
}

export interface WorkoutDTO {
  id: string;
  date: string;
  type: WorkoutType;
  duration_minutes: number | null;
  warmup_minutes: number | null;
  notes: string | null;
  exercises: ExerciseDTO[];
  cardio: CardioDTO[];
}

export interface HistoryResponse {
  workouts: WorkoutDTO[];
  hasMore: boolean;
}

export interface SummaryResponse {
  totalWorkouts: number;
  weekStreak: number;
  weekVolumeKg: number;
  weekWorkouts: number;
}

export interface ProgressPoint {
  date: string;
  maxWeight: number;
  volumeKg: number;
}

export interface ProgressResponse {
  exercise: string;
  points: ProgressPoint[];
}
