import { supabase } from '../db/client';
import { SetEntry } from '../types/domain';
import {
  WorkoutDTO,
  ExerciseDTO,
  CardioDTO,
  SummaryResponse,
  ProgressPoint,
} from '../types/webapp';

interface WorkoutRow {
  id: string;
  date: string;
  type: WorkoutDTO['type'];
  duration_minutes: number | null;
  warmup_minutes: number | null;
  notes: string | null;
}

// --- История: страница тренировок с вложенными упражнениями и кардио ---
export async function getHistoryPage(
  userId: number,
  offset: number,
  limit: number
): Promise<{ workouts: WorkoutDTO[]; hasMore: boolean }> {
  // Берём на 1 больше запрошенного, чтобы понять, есть ли ещё страницы.
  const { data: workoutRows, error } = await supabase
    .from('workouts')
    .select('id, date, type, duration_minutes, warmup_minutes, notes')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .range(offset, offset + limit);
  if (error) throw new Error(`getHistoryPage/workouts: ${error.message}`);

  const rows = (workoutRows ?? []) as WorkoutRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const ids = pageRows.map((w) => w.id);

  const [exercisesByWorkout, cardioByWorkout] = await Promise.all([
    fetchExercises(ids),
    fetchCardio(ids),
  ]);

  const workouts: WorkoutDTO[] = pageRows.map((w) => ({
    id: w.id,
    date: w.date,
    type: w.type,
    duration_minutes: w.duration_minutes,
    warmup_minutes: w.warmup_minutes,
    notes: w.notes,
    exercises: exercisesByWorkout.get(w.id) ?? [],
    cardio: cardioByWorkout.get(w.id) ?? [],
  }));

  return { workouts, hasMore };
}

async function fetchExercises(workoutIds: string[]): Promise<Map<string, ExerciseDTO[]>> {
  const map = new Map<string, ExerciseDTO[]>();
  if (workoutIds.length === 0) return map;

  const { data, error } = await supabase
    .from('exercises')
    .select('workout_id, name, sets, order_index')
    .in('workout_id', workoutIds)
    .order('order_index', { ascending: true });
  if (error) throw new Error(`fetchExercises: ${error.message}`);

  for (const row of (data ?? []) as { workout_id: string; name: string; sets: SetEntry[] }[]) {
    const list = map.get(row.workout_id) ?? [];
    list.push({ name: row.name, sets: row.sets ?? [] });
    map.set(row.workout_id, list);
  }
  return map;
}

async function fetchCardio(workoutIds: string[]): Promise<Map<string, CardioDTO[]>> {
  const map = new Map<string, CardioDTO[]>();
  if (workoutIds.length === 0) return map;

  const { data, error } = await supabase
    .from('cardio_sessions')
    .select('workout_id, activity, distance_km, avg_heart_rate, avg_pace, incline_percent')
    .in('workout_id', workoutIds);
  if (error) throw new Error(`fetchCardio: ${error.message}`);

  for (const row of (data ?? []) as (CardioDTO & { workout_id: string })[]) {
    const list = map.get(row.workout_id) ?? [];
    list.push({
      activity: row.activity,
      distance_km: row.distance_km,
      avg_heart_rate: row.avg_heart_rate,
      avg_pace: row.avg_pace,
      incline_percent: row.incline_percent,
    });
    map.set(row.workout_id, list);
  }
  return map;
}

// --- Список названий упражнений пользователя (для выпадашки прогресса) ---
export async function getExerciseNames(userId: number, limit: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('name, workouts!inner(user_id, date)')
    .eq('workouts.user_id', userId)
    .order('date', { foreignTable: 'workouts', ascending: false })
    .limit(300);
  if (error) throw new Error(`getExerciseNames: ${error.message}`);

  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of (data ?? []) as { name: string }[]) {
    if (!seen.has(row.name)) {
      seen.add(row.name);
      names.push(row.name);
    }
    if (names.length >= limit) break;
  }
  return names;
}

// --- Прогресс по упражнению: макс. вес и объём за каждую сессию ---
export async function getProgress(userId: number, exerciseName: string): Promise<ProgressPoint[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('sets, workouts!inner(user_id, date)')
    .eq('workouts.user_id', userId)
    .eq('name', exerciseName)
    .order('date', { foreignTable: 'workouts', ascending: true });
  if (error) throw new Error(`getProgress: ${error.message}`);

  // Supabase для embed «многие-к-одному» (exercises → workouts) возвращает
  // объект, а не массив. Нормализуем на случай обеих форм, чтобы не упасть на .date.
  return ((data ?? []) as unknown as {
    sets: SetEntry[];
    workouts: { date: string } | { date: string }[];
  }[]).map((row) => {
    const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
    const sets = row.sets ?? [];
    const maxWeight = sets.length ? Math.max(...sets.map((s) => s.weight)) : 0;
    const volumeKg = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    return { date: workout?.date ?? '', maxWeight, volumeKg };
  });
}

// Недельная цель по числу тренировок. Пока константа; позже — из профиля
// пользователя (тогда меняется только эта строка, контракт SummaryResponse готов).
const WEEKLY_GOAL_DEFAULT = 3;

// --- Сводка: всего тренировок, недельный стрик, объём и число за текущую неделю ---
export async function getSummary(userId: number): Promise<SummaryResponse> {
  const { data: workoutRows, error } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw new Error(`getSummary/workouts: ${error.message}`);

  const rows = (workoutRows ?? []) as { id: string; date: string }[];
  const totalWorkouts = rows.length;

  const weekKeys = new Set(rows.map((r) => mondayKey(new Date(r.date))));
  const weekStreak = computeWeekStreak(weekKeys);

  const thisWeekKey = mondayKey(new Date());
  const thisWeekIds = rows.filter((r) => mondayKey(new Date(r.date)) === thisWeekKey).map((r) => r.id);
  const weekWorkouts = thisWeekIds.length;
  const weekVolumeKg = await weekVolume(thisWeekIds);

  return { totalWorkouts, weekStreak, weekVolumeKg, weekWorkouts, weekGoal: WEEKLY_GOAL_DEFAULT };
}

async function weekVolume(workoutIds: string[]): Promise<number> {
  if (workoutIds.length === 0) return 0;
  const { data, error } = await supabase.from('exercises').select('sets').in('workout_id', workoutIds);
  if (error) throw new Error(`weekVolume: ${error.message}`);

  let total = 0;
  for (const row of (data ?? []) as { sets: SetEntry[] }[]) {
    for (const s of row.sets ?? []) total += s.weight * s.reps;
  }
  return Math.round(total);
}

// Ключ недели = дата понедельника этой недели (UTC) в формате YYYY-MM-DD.
function mondayKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=вс..6=сб
  const diffToMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}

function computeWeekStreak(weekKeys: Set<string>): number {
  if (weekKeys.size === 0) return 0;

  const cursor = new Date(mondayKey(new Date()) + 'T00:00:00Z');
  // Льгота: если на текущей неделе ещё не тренировался, считаем от прошлой недели.
  if (!weekKeys.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  let streak = 0;
  while (weekKeys.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return streak;
}
