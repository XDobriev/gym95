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
  weekGoal: number;
}

export interface ProgressPoint {
  date: string;
  maxWeight: number;
  volumeKg: number;
  maxReps?: number;
  totalReps?: number;
  distanceKm?: number;
  durationMinutes?: number;
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

// --- Вкладка «Тело» (GET /api/body) --- зеркало в webapp/shared/types.ts
export interface BodyResponse {
  modules: { weight: boolean; sleep: boolean; food: boolean; water: boolean; activity: boolean };
  weights: { date: string; kg: number }[]; // по одному значению в день, 90 дней
  weightAvg7: number | null;
  weightWeekChange: number | null;
  weightMonthChange: number | null;
  sleep: { date: string; hours: number }[]; // 30 дней
  sleepAvg7: number | null;
  food: { date: string; kcal: number }[]; // сумма за день, 30 дней (только дни с записями)
  foodAvg7: number | null;
  kcalNorm: number | null;
  waterTodayMl: number;
  waterTargetMl: number;
  chain: { current: number; best: number; goal: number; deadline: string | null } | null;
  measurements: { date: string; values: Record<string, number | null> }[]; // последние 2, новые первыми
}

// --- Live Workout (GET /api/live-context, POST /api/workouts) ---
export interface LiveTemplateItem {
  id: string;
  name: string;
  exercises: { name: string; defaultSetsCount: number }[];
}

export interface LivePastWorkout {
  id: string;
  date: string;
  type: WorkoutType;
  exercises: ExerciseDTO[];
}

export interface LiveContextResponse {
  lastWorkout: LivePastWorkout | null;
  templates: LiveTemplateItem[];
  commonExercises: string[];
}

export interface CompletedSetInput {
  weight: number;
  reps: number;
  completed: boolean;
}

export interface LiveExerciseInput {
  name: string;
  sets: CompletedSetInput[];
}

export interface SaveLiveWorkoutRequest {
  durationMinutes: number;
  warmupMinutes?: number;
  notes?: string;
  templateId?: string;
  saveAsTemplateName?: string;
  exercises: LiveExerciseInput[];
}

export interface NewPersonalRecord {
  exercise: string;
  weight: number;
  reps: number;
  oneRepMax: number;
  prevOneRepMax: number;
}

export interface SaveLiveWorkoutResponse {
  ok: boolean;
  workoutId: string;
  newPrs: NewPersonalRecord[];
  summaryText: string;
}
