import { supabase } from './client';
import { MeasureKey, Measurements, MEASURE_FIELDS } from '../utils/measure';

export interface MeasurementRow extends Record<MeasureKey, number | null> {
  id: string;
  measured_on: string;
}

function normalize(row: Record<string, unknown>): MeasurementRow {
  const out = { id: row.id as string, measured_on: row.measured_on as string } as MeasurementRow;
  for (const f of MEASURE_FIELDS) out[f.key] = row[f.key] === null ? null : Number(row[f.key]);
  return out;
}

export async function addMeasurements(userId: number, measuredOn: string, values: Measurements): Promise<void> {
  const { error } = await supabase.from('body_measurements').insert({ user_id: userId, measured_on: measuredOn, ...values });
  if (error) throw new Error(`addMeasurements: ${error.message}`);
}

// Последние замеры строго до даты (для сравнения) или вообще последние (beforeDate не задан).
export async function getLastMeasurements(userId: number, beforeDate?: string): Promise<MeasurementRow | null> {
  let q = supabase.from('body_measurements').select().eq('user_id', userId);
  if (beforeDate) q = q.lt('measured_on', beforeDate);
  const { data, error } = await q.order('measured_on', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`getLastMeasurements: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}
