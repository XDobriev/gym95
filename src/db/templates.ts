import { supabase } from './client';
import { CardioActivity, SetEntry, Workout } from '../types/domain';

export type TemplateType = 'strength' | 'cardio' | 'mixed';

export interface TemplateExercise {
  name: string;
  sets: SetEntry[];
}

export interface TemplateCardio {
  activity: CardioActivity;
  durationMinutes: number | null;
  distanceKm: number | null;
}

export interface WorkoutTemplate {
  id: string;
  user_id: number | null; // null — готовый шаблон для всех
  slug: string | null;
  name: string;
  type: TemplateType;
  exercises: TemplateExercise[];
  cardio: TemplateCardio | null;
  rotation_group: string | null;
  rotation_order: number | null;
  sort_order: number;
}

// Готовые шаблоны + личные шаблоны пользователя.
export async function listTemplates(userId: number): Promise<WorkoutTemplate[]> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select()
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listTemplates: ${error.message}`);
  return (data ?? []) as WorkoutTemplate[];
}

export async function getTemplate(userId: number, id: string): Promise<WorkoutTemplate | null> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select()
    .eq('id', id)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .maybeSingle();
  if (error) throw new Error(`getTemplate: ${error.message}`);
  return (data as WorkoutTemplate | null) ?? null;
}

export async function createTemplate(params: {
  userId: number;
  name: string;
  type: TemplateType;
  exercises: TemplateExercise[];
  cardio: TemplateCardio | null;
}): Promise<WorkoutTemplate> {
  const { data, error } = await supabase
    .from('workout_templates')
    .insert({
      user_id: params.userId,
      name: params.name,
      type: params.type,
      exercises: params.exercises,
      cardio: params.cardio,
    })
    .select()
    .single();
  if (error) throw new Error(`createTemplate: ${error.message}`);
  return data as WorkoutTemplate;
}

// Удаляет только личный шаблон пользователя. false — нечего удалять.
export async function deleteOwnTemplate(userId: number, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(`deleteOwnTemplate: ${error.message}`);
  return (data ?? []).length > 0;
}

// Последняя тренировка пользователя по одному из шаблонов (по дате).
export async function getLastWorkoutForTemplates(userId: number, templateIds: string[]): Promise<Workout | null> {
  if (templateIds.length === 0) return null;
  const { data, error } = await supabase
    .from('workouts')
    .select()
    .eq('user_id', userId)
    .in('template_id', templateIds)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLastWorkoutForTemplates: ${error.message}`);
  return (data as Workout | null) ?? null;
}
