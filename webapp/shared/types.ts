// Доменные типы, общие для фронта и API. Зеркалят src/types/domain.ts бота
// (та же схема Supabase), но webapp самодостаточен и не импортирует из ../src.

export type WorkoutType = 'cardio' | 'strength' | 'pool' | 'mixed';

export interface SetEntry {
  weight: number;
  reps: number;
}

export interface ExerciseDTO {
  name: string;
  sets: SetEntry[];
}

export type CardioActivity = 'treadmill' | 'pool' | 'bike' | 'running' | 'walking';

export interface CardioDTO {
  activity: CardioActivity;
  distance_km: number | null;
  avg_heart_rate: number | null;
  avg_pace: string | null;
  incline_percent: number | null;
}

// Тренировка с вложенными упражнениями/кардио — то, что отдаёт /api/history.
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
  weekGoal: number;
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

export interface VolumeHistoryPoint {
  weekStart: string;
  volumeKg: number;
}

export interface VolumeHistoryResponse {
  weeks: VolumeHistoryPoint[];
}

// --- Редактирование (PUT /api/workout/:id) ---
// Подходы шлём строкой ("40x12, 42.5x10") — сервер парсит тем же parseSetsLine,
// что и мастер создания в боте: одна точка правды для формата.
export interface ExerciseInput {
  name: string;
  setsText: string;
}

export interface CardioInput {
  activity: CardioActivity;
  distanceKm: number | null;
  avgHeartRate: number | null;
  inclinePercent: number | null;
}

export interface WorkoutUpdateRequest {
  date: string; // yyyy-mm-dd или ISO
  type: WorkoutType;
  durationMinutes: number | null;
  warmupMinutes: number | null;
  notes: string | null;
  exercises: ExerciseInput[];
  cardio: CardioInput[];
}
