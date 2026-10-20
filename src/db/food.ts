import { supabase } from './client';
import { Meal } from '../utils/food';

export interface FoodEntry {
  id: string;
  eaten_on: string;
  meal: Meal | null;
  description: string | null;
  kcal: number;
  created_at: string;
}

export async function addFood(params: {
  userId: number;
  eatenOn: string;
  meal: Meal | null;
  description: string | null;
  kcal: number;
}): Promise<FoodEntry> {
  const { data, error } = await supabase
    .from('food_entries')
    .insert({
      user_id: params.userId,
      eaten_on: params.eatenOn,
      meal: params.meal,
      description: params.description,
      kcal: params.kcal,
    })
    .select()
    .single();
  if (error) throw new Error(`addFood: ${error.message}`);
  return data as FoodEntry;
}

export async function updateFoodKcal(userId: number, id: string, kcal: number): Promise<boolean> {
  const { data, error } = await supabase.from('food_entries').update({ kcal }).eq('id', id).eq('user_id', userId).select('id');
  if (error) throw new Error(`updateFoodKcal: ${error.message}`);
  return (data ?? []).length > 0;
}

export async function deleteFood(userId: number, id: string): Promise<boolean> {
  const { data, error } = await supabase.from('food_entries').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) throw new Error(`deleteFood: ${error.message}`);
  return (data ?? []).length > 0;
}

export async function getFoodEntry(userId: number, id: string): Promise<FoodEntry | null> {
  const { data, error } = await supabase.from('food_entries').select().eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`getFoodEntry: ${error.message}`);
  return (data as FoodEntry | null) ?? null;
}

// Записи за даты [fromDate, toDate] включительно, по порядку ввода.
export async function getFoodBetween(userId: number, fromDate: string, toDate: string): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from('food_entries')
    .select()
    .eq('user_id', userId)
    .gte('eaten_on', fromDate)
    .lte('eaten_on', toDate)
    .order('eaten_on', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getFoodBetween: ${error.message}`);
  return ((data ?? []) as FoodEntry[]).map((e) => ({ ...e, kcal: Number(e.kcal) }));
}
