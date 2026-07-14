export type WorkoutType = 'cardio' | 'strength' | 'pool' | 'mixed';

export interface Workout {
  id: string;
  user_id: number;
  date: string;
  type: WorkoutType;
  duration_minutes: number | null;
  notes: string | null;
  warmup_minutes: number | null;
}

export interface SetEntry {
  weight: number;
  reps: number;
}

export interface Exercise {
  id: string;
  workout_id: string;
  name: string;
  sets: SetEntry[];
  order_index: number;
}

export type CardioActivity = 'treadmill' | 'pool' | 'bike' | 'running' | 'walking';

export interface CardioSession {
  id: string;
  workout_id: string;
  activity: CardioActivity;
  distance_km: number | null;
  avg_heart_rate: number | null;
  avg_pace: string | null;
  incline_percent: number | null;
}

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'abs';
