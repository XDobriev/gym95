import { supabase } from './client';
import { CardioActivity, CardioSession } from '../types/domain';

export async function addCardioSession(params: {
  workoutId: string;
  activity: CardioActivity;
  distanceKm: number | null;
  avgHeartRate: number | null;
  avgPace: string | null;
}): Promise<CardioSession> {
  const { data, error } = await supabase
    .from('cardio_sessions')
    .insert({
      workout_id: params.workoutId,
      activity: params.activity,
      distance_km: params.distanceKm,
      avg_heart_rate: params.avgHeartRate,
      avg_pace: params.avgPace,
    })
    .select()
    .single();

  if (error) throw new Error(`addCardioSession: ${error.message}`);
  return data as CardioSession;
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
