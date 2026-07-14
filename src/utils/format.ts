import { CardioActivity, SetEntry, WorkoutType } from '../types/domain';

export function formatSet(set: SetEntry): string {
  return set.weight > 0 ? `${set.weight}×${set.reps}` : `×${set.reps}`;
}

// Склонение по правилам русского языка: 1 подход, 2 подхода, 5 подходов.
export function pluralizeRu(n: number, forms: [one: string, few: string, many: string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function formatSetsInline(sets: SetEntry[]): string {
  return sets.map(formatSet).join(', ');
}

const TYPE_LABELS_RU: Record<WorkoutType, string> = {
  strength: 'Силовая',
  cardio: 'Кардио',
  pool: 'Бассейн',
  mixed: 'Смешанная',
};

const TYPE_EMOJI: Record<WorkoutType, string> = {
  strength: '🏋️',
  cardio: '🏃',
  pool: '🏊',
  mixed: '🔀',
};

export function formatWorkoutTypeRu(type: WorkoutType): string {
  return TYPE_LABELS_RU[type];
}

export function formatWorkoutTypeWithEmoji(type: WorkoutType): string {
  return `${TYPE_EMOJI[type]} ${TYPE_LABELS_RU[type]}`;
}

export function formatDateShortRu(isoDate: string): string {
  const date = new Date(isoDate);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatDateIsoDay(isoDate: string): string {
  return new Date(isoDate).toISOString().slice(0, 10);
}

const CARDIO_ACTIVITY_LABELS: Record<CardioActivity, string> = {
  treadmill: 'Беговая дорожка',
  pool: 'Бассейн',
  bike: 'Велосипед',
  running: 'Бег',
  walking: 'Ходьба',
};

const CARDIO_ACTIVITY_EMOJI: Record<CardioActivity, string> = {
  treadmill: '🎽',
  pool: '🏊',
  bike: '🚴',
  running: '🏃',
  walking: '🚶',
};

export function formatCardioInline(cardio: {
  activity: CardioActivity;
  durationMinutes: number | null;
  distanceKm: number | null;
  avgHeartRate: number | null;
  inclinePercent?: number | null;
}): string {
  const parts = [`${CARDIO_ACTIVITY_EMOJI[cardio.activity]} ${CARDIO_ACTIVITY_LABELS[cardio.activity]}`];
  if (cardio.durationMinutes !== null) parts.push(`🕒 ${cardio.durationMinutes} мин`);
  if (cardio.distanceKm !== null) parts.push(`📏 ${cardio.distanceKm} км`);
  if (cardio.inclinePercent !== null && cardio.inclinePercent !== undefined) parts.push(`⛰️ уклон ${cardio.inclinePercent}%`);
  if (cardio.avgHeartRate !== null) parts.push(`❤️ ${cardio.avgHeartRate} уд/мин`);
  return parts.join('\n');
}
