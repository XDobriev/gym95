import type { WorkoutType, CardioActivity, SetEntry } from '../shared/types';

export const TYPE_LABEL: Record<WorkoutType, string> = {
  strength: 'Силовая',
  cardio: 'Кардио',
  pool: 'Бассейн',
  mixed: 'Смешанная',
};

export const TYPE_EMOJI: Record<WorkoutType, string> = {
  strength: '🏋️',
  cardio: '🏃',
  pool: '🏊',
  mixed: '🔀',
};

export const CARDIO_LABEL: Record<CardioActivity, string> = {
  treadmill: 'Беговая дорожка',
  pool: 'Бассейн',
  bike: 'Велосипед',
  running: 'Бег',
  walking: 'Ходьба',
};

export function formatSet(set: SetEntry): string {
  return set.weight > 0 ? `${set.weight}×${set.reps}` : `×${set.reps}`;
}

export function formatSetsInline(sets: SetEntry[]): string {
  return sets.map(formatSet).join(', ');
}

export function pluralizeRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function formatDateDDMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export function monthLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const label = MONTHS[d.getMonth()];
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

// Тоннаж в человекочитаемом виде: 8420 → «8.4 т», 640 → «640 кг».
export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} т`;
  return `${kg} кг`;
}
