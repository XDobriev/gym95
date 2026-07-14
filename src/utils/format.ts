import { CardioActivity, SetEntry, WorkoutType } from '../types/domain';

export function formatSet(set: SetEntry): string {
  return set.weight > 0 ? `${set.weight}×${set.reps}` : `×${set.reps}`;
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
};

const CARDIO_ACTIVITY_EMOJI: Record<CardioActivity, string> = {
  treadmill: '🏃',
  pool: '🏊',
  bike: '🚴',
};

export function formatCardioInline(cardio: {
  activity: CardioActivity;
  durationMinutes: number | null;
  distanceKm: number | null;
  avgHeartRate: number | null;
}): string {
  const parts = [`${CARDIO_ACTIVITY_EMOJI[cardio.activity]} ${CARDIO_ACTIVITY_LABELS[cardio.activity]}`];
  if (cardio.durationMinutes !== null) parts.push(`🕒 ${cardio.durationMinutes} мин`);
  if (cardio.distanceKm !== null) parts.push(`📏 ${cardio.distanceKm} км`);
  if (cardio.avgHeartRate !== null) parts.push(`❤️ ${cardio.avgHeartRate} уд/мин`);
  return parts.join(', ');
}
