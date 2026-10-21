import { supabase } from './client';
import { CardioActivity, CardioSession } from '../types/domain';
import { getWorkoutOwned } from './workouts';

export async function addCardioSession(params: {
  workoutId: string;
  activity: CardioActivity;
  distanceKm: number | null;
  avgHeartRate: number | null;
  avgPace: string | null;
  inclinePercent: number | null;
}): Promise<CardioSession> {
  const { data, error } = await supabase
    .from('cardio_sessions')
    .insert({
      workout_id: params.workoutId,
      activity: params.activity,
      distance_km: params.distanceKm,
      avg_heart_rate: params.avgHeartRate,
      avg_pace: params.avgPace,
      incline_percent: params.inclinePercent,
    })
    .select()
    .single();

  if (error) throw new Error(`addCardioSession: ${error.message}`);
  return data as CardioSession;
}

// Полностью заменяет кардио-блок тренировки (для PUT из Mini App). avg_pace
// вызывающий считает заранее (нужна длительность тренировки + дистанция).
// Владельца тренировки вызывающий проверяет заранее (getWorkoutOwned).
export async function replaceWorkoutCardio(
  workoutId: string,
  sessions: {
    activity: CardioActivity;
    distanceKm: number | null;
    avgHeartRate: number | null;
    avgPace: string | null;
    inclinePercent: number | null;
  }[]
): Promise<void> {
  const { error: delError } = await supabase.from('cardio_sessions').delete().eq('workout_id', workoutId);
  if (delError) throw new Error(`replaceWorkoutCardio/delete: ${delError.message}`);

  if (sessions.length === 0) return;

  const rows = sessions.map((s) => ({
    workout_id: workoutId,
    activity: s.activity,
    distance_km: s.distanceKm,
    avg_heart_rate: s.avgHeartRate,
    avg_pace: s.avgPace,
    incline_percent: s.inclinePercent,
  }));
  const { error: insError } = await supabase.from('cardio_sessions').insert(rows);
  if (insError) throw new Error(`replaceWorkoutCardio/insert: ${insError.message}`);
}

export interface CardioFieldsUpdate {
  activity?: CardioActivity;
  distanceKm?: number | null;
  avgHeartRate?: number | null;
  avgPace?: string | null;
  inclinePercent?: number | null;
}

// Точечная правка кардио-сессии (для бота). Owner-проверка через тренировку.
export async function updateCardioSession(
  userId: number,
  workoutId: string,
  cardioId: string,
  fields: CardioFieldsUpdate
): Promise<boolean> {
  const owner = await getWorkoutOwned(userId, workoutId);
  if (!owner) return false;

  const patch: Record<string, unknown> = {};
  if (fields.activity !== undefined) patch.activity = fields.activity;
  if (fields.distanceKm !== undefined) patch.distance_km = fields.distanceKm;
  if (fields.avgHeartRate !== undefined) patch.avg_heart_rate = fields.avgHeartRate;
  if (fields.avgPace !== undefined) patch.avg_pace = fields.avgPace;
  if (fields.inclinePercent !== undefined) patch.incline_percent = fields.inclinePercent;

  if (Object.keys(patch).length === 0) return true;

  const { error } = await supabase
    .from('cardio_sessions')
    .update(patch)
    .eq('id', cardioId)
    .eq('workout_id', workoutId);

  if (error) throw new Error(`updateCardioSession: ${error.message}`);
  return true;
}

export async function getCardioSessionsForWorkouts(workoutIds: string[]): Promise<CardioSession[]> {
  if (workoutIds.length === 0) return [];

  const { data, error } = await supabase
    .from('cardio_sessions')
    .select()
    .in('workout_id', workoutIds);

  if (error) throw new Error(`getCardioSessionsForWorkouts: ${error.message}`);
  return (data ?? []) as CardioSession[];
}

export interface CardioHistoryPoint {
  date: string;
  activity: CardioActivity;
  durationMinutes: number | null;
  distanceKm: number | null;
  avgHeartRate: number | null;
  avgPace: string | null;
}

// Хронологическая история кардио-сессий пользователя по конкретному типу активности
export async function getCardioHistory(
  userId: number,
  activity?: CardioActivity
): Promise<CardioHistoryPoint[]> {
  let query = supabase
    .from('cardio_sessions')
    .select('activity, distance_km, avg_heart_rate, avg_pace, workouts!inner(user_id, date, duration_minutes)')
    .eq('workouts.user_id', userId)
    .order('date', { foreignTable: 'workouts', ascending: true });

  if (activity) {
    query = query.eq('activity', activity);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getCardioHistory: ${error.message}`);

  return ((data ?? []) as unknown as {
    activity: CardioActivity;
    distance_km: number | null;
    avg_heart_rate: number | null;
    avg_pace: string | null;
    workouts: { date: string; duration_minutes: number | null } | { date: string; duration_minutes: number | null }[];
  }[]).map((row) => {
    const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
    return {
      date: workout?.date ?? '',
      activity: row.activity,
      durationMinutes: workout?.duration_minutes ?? null,
      distanceKm: row.distance_km !== null ? Number(row.distance_km) : null,
      avgHeartRate: row.avg_heart_rate,
      avgPace: row.avg_pace,
    };
  });
}

// Последние использованные типы кардио-активностей пользователя
export async function getLastCardioActivitiesByUser(userId: number): Promise<CardioActivity[]> {
  const { data, error } = await supabase
    .from('cardio_sessions')
    .select('activity, workouts!inner(user_id, date)')
    .eq('workouts.user_id', userId)
    .order('date', { foreignTable: 'workouts', ascending: false })
    .limit(20);

  if (error) throw new Error(`getLastCardioActivitiesByUser: ${error.message}`);
  const seen = new Set<CardioActivity>();
  const list: CardioActivity[] = [];
  for (const row of (data ?? []) as { activity: CardioActivity }[]) {
    if (!seen.has(row.activity)) {
      seen.add(row.activity);
      list.push(row.activity);
    }
  }
  return list;
}
