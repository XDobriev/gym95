import { supabase } from '../db/client';
import { getSettings } from '../db/settings';
import { getUserTimezone } from '../db/profiles';
import { addDays, localMidnightUtc, localWeekStart, weekStartOf } from '../utils/time';
import { SetEntry, CardioActivity } from '../types/domain';
import {
  WorkoutDTO,
  ExerciseDTO,
  CardioDTO,
  SummaryResponse,
  ProgressPoint,
  VolumeHistoryPoint,
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

const CARDIO_WEB_MAP: Record<string, CardioActivity> = {
  '🏃 Бег (кардио)': 'running',
  '🚶 Ходьба / Стадион (кардио)': 'walking',
  '🎽 Беговая дорожка (кардио)': 'treadmill',
  '🚴 Велосипед (кардио)': 'bike',
  '🏊 Бассейн (кардио)': 'pool',
};

const CARDIO_REVERSE_MAP: Record<CardioActivity, string> = {
  running: '🏃 Бег (кардио)',
  walking: '🚶 Ходьба / Стадион (кардио)',
  treadmill: '🎽 Беговая дорожка (кардио)',
  bike: '🚴 Велосипед (кардио)',
  pool: '🏊 Бассейн (кардио)',
};

// --- Список названий упражнений пользователя (для выпадашки прогресса) ---
export async function getExerciseNames(userId: number, limit: number): Promise<string[]> {
  const [{ data, error }, { data: cardioData }] = await Promise.all([
    supabase
      .from('exercises')
      .select('name, workouts!inner(user_id, date)')
      .eq('workouts.user_id', userId)
      .order('date', { foreignTable: 'workouts', ascending: false })
      .limit(300),
    supabase
      .from('cardio_sessions')
      .select('activity, workouts!inner(user_id, date)')
      .eq('workouts.user_id', userId)
      .order('date', { foreignTable: 'workouts', ascending: false })
      .limit(50),
  ]);
  if (error) throw new Error(`getExerciseNames: ${error.message}`);

  const seen = new Set<string>();
  const names: string[] = [];

  if (cardioData) {
    for (const row of cardioData as unknown as { activity: CardioActivity }[]) {
      const label = CARDIO_REVERSE_MAP[row.activity];
      if (label && !seen.has(label)) {
        seen.add(label);
        names.push(label);
      }
    }
  }

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
  const cardioActivity = CARDIO_WEB_MAP[exerciseName];
  if (cardioActivity) {
    const { data: cardioRows, error: cardioError } = await supabase
      .from('cardio_sessions')
      .select('distance_km, workouts!inner(user_id, date, duration_minutes)')
      .eq('workouts.user_id', userId)
      .eq('activity', cardioActivity)
      .order('date', { foreignTable: 'workouts', ascending: true });
    if (cardioError) throw new Error(`getProgress/cardio: ${cardioError.message}`);

    return ((cardioRows ?? []) as unknown as {
      distance_km: number | null;
      workouts: { date: string; duration_minutes: number | null } | { date: string; duration_minutes: number | null }[];
    }[]).map((row) => {
      const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
      return {
        date: workout?.date ?? '',
        maxWeight: 0,
        volumeKg: 0,
        distanceKm: row.distance_km !== null ? Number(row.distance_km) : 0,
        durationMinutes: workout?.duration_minutes ?? 0,
      };
    });
  }

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
    const maxReps = sets.length ? Math.max(...sets.map((s) => s.reps)) : 0;
    const totalReps = sets.reduce((sum, s) => sum + s.reps, 0);
    return { date: workout?.date ?? '', maxWeight, volumeKg, maxReps, totalReps };
  });
}

// --- Сводка: всего тренировок, недельный стрик, объём и число за текущую неделю ---
export async function getSummary(userId: number): Promise<SummaryResponse> {
  const tz = await getUserTimezone(userId);
  const { data: workoutRows, error } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw new Error(`getSummary/workouts: ${error.message}`);

  const rows = (workoutRows ?? []) as { id: string; date: string }[];
  const totalWorkouts = rows.length;

  const weekKeys = new Set(rows.map((r) => weekStartOf(new Date(r.date), tz)));
  const thisWeekKey = localWeekStart(tz);
  const weekStreak = computeWeekStreak(weekKeys, thisWeekKey);

  const thisWeekIds = rows.filter((r) => weekStartOf(new Date(r.date), tz) === thisWeekKey).map((r) => r.id);
  const weekWorkouts = thisWeekIds.length;
  const [weekVolumeKg, settings] = await Promise.all([weekVolume(thisWeekIds), getSettings(userId)]);

  return { totalWorkouts, weekStreak, weekVolumeKg, weekWorkouts, weekGoal: settings.week_goal };
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

function computeWeekStreak(weekKeys: Set<string>, thisWeekKey: string): number {
  if (weekKeys.size === 0) return 0;

  let cursor = thisWeekKey;
  // Льгота: если на текущей неделе ещё не тренировался, считаем от прошлой недели.
  if (!weekKeys.has(cursor)) cursor = addDays(cursor, -7);

  let streak = 0;
  while (weekKeys.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

// --- История тоннажа по неделям для графика на «Прогрессе» (zero-fill) ---
export async function getVolumeHistory(userId: number, weeks = 12): Promise<VolumeHistoryPoint[]> {
  const tz = await getUserTimezone(userId);
  const weekStarts = lastMondays(weeks, localWeekStart(tz)); // по возрастанию, [0] — самая старая неделя
  const earliestIso = localMidnightUtc(weekStarts[0], tz).toISOString();

  const { data, error } = await supabase
    .from('exercises')
    .select('sets, workouts!inner(user_id, date)')
    .eq('workouts.user_id', userId)
    .gte('workouts.date', earliestIso)
    .order('date', { foreignTable: 'workouts', ascending: true });
  if (error) throw new Error(`getVolumeHistory: ${error.message}`);

  const totals = new Map<string, number>(weekStarts.map((w) => [w, 0]));
  for (const row of (data ?? []) as unknown as {
    sets: SetEntry[];
    workouts: { date: string } | { date: string }[];
  }[]) {
    const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
    if (!workout?.date) continue;
    const key = weekStartOf(new Date(workout.date), tz);
    if (!totals.has(key)) continue; // защита от пограничных строк вне запрошенного окна
    const volume = (row.sets ?? []).reduce((sum, s) => sum + s.weight * s.reps, 0);
    totals.set(key, (totals.get(key) ?? 0) + volume);
  }

  return weekStarts.map((weekStart) => ({ weekStart, volumeKg: Math.round(totals.get(weekStart) ?? 0) }));
}

// Понедельники последних `weeks` недель включительно текущей, по возрастанию дат.
function lastMondays(weeks: number, thisWeekKey: string): string[] {
  const result: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) result.push(addDays(thisWeekKey, -7 * i));
  return result;
}
