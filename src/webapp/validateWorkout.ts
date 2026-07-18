import { WorkoutType, CardioActivity, SetEntry } from '../types/domain';
import { parseSetsLine } from '../utils/setsParser';
import { computeAvgPace } from '../utils/cardio';

// Нормализованный, провалидированный payload PUT /api/workout/:id.
// Подходы уже разобраны из текстовой строки, avg_pace посчитан.
export interface NormalizedWorkoutInput {
  fields: {
    date: string;
    type: WorkoutType;
    durationMinutes: number | null;
    warmupMinutes: number | null;
    notes: string | null;
  };
  exercises: { name: string; sets: SetEntry[] }[];
  cardio: {
    activity: CardioActivity;
    distanceKm: number | null;
    avgHeartRate: number | null;
    avgPace: string | null;
    inclinePercent: number | null;
  }[];
}

export type ValidationResult =
  | { ok: true; value: NormalizedWorkoutInput }
  | { ok: false; error: string };

const WORKOUT_TYPES: WorkoutType[] = ['cardio', 'strength', 'pool', 'mixed'];
const CARDIO_ACTIVITIES: CardioActivity[] = ['treadmill', 'pool', 'bike', 'running', 'walking'];
const NOTES_MAX_LENGTH = 1000;
const NAME_MAX_LENGTH = 100;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

// Необязательное неотрицательное целое: допускаем null/отсутствие, иначе целое > 0.
function optionalPositiveInt(v: unknown, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v <= 0) {
    return { ok: false, error: `${label}: ожидается целое число больше нуля или пусто` };
  }
  return { ok: true, value: v };
}

function optionalPositiveNumber(v: unknown, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
    return { ok: false, error: `${label}: ожидается число больше нуля или пусто` };
  }
  return { ok: true, value: v };
}

function optionalNonNegativeNumber(v: unknown, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    return { ok: false, error: `${label}: ожидается неотрицательное число или пусто` };
  }
  return { ok: true, value: v };
}

export function validateWorkoutInput(body: unknown): ValidationResult {
  if (!isRecord(body)) return fail('Тело запроса должно быть объектом');

  // --- Дата ---
  if (typeof body.date !== 'string' || body.date.trim() === '') {
    return fail('Дата обязательна');
  }
  const parsedDate = new Date(body.date);
  if (Number.isNaN(parsedDate.getTime())) {
    return fail('Некорректная дата');
  }

  // --- Тип ---
  if (typeof body.type !== 'string' || !WORKOUT_TYPES.includes(body.type as WorkoutType)) {
    return fail('Некорректный тип тренировки');
  }
  const type = body.type as WorkoutType;

  // --- Скалярные поля ---
  const duration = optionalPositiveInt(body.durationMinutes, 'Длительность');
  if (!duration.ok) return fail(duration.error);
  const warmup = optionalPositiveInt(body.warmupMinutes, 'Разминка');
  if (!warmup.ok) return fail(warmup.error);

  let notes: string | null = null;
  if (body.notes !== null && body.notes !== undefined) {
    if (typeof body.notes !== 'string') return fail('Заметки должны быть строкой');
    const trimmed = body.notes.trim();
    if (trimmed.length > NOTES_MAX_LENGTH) return fail(`Заметки слишком длинные (максимум ${NOTES_MAX_LENGTH})`);
    notes = trimmed === '' ? null : trimmed;
  }

  // --- Упражнения ---
  if (!Array.isArray(body.exercises)) return fail('Поле exercises должно быть массивом');
  const exercises: { name: string; sets: SetEntry[] }[] = [];
  for (let i = 0; i < body.exercises.length; i++) {
    const raw = body.exercises[i];
    if (!isRecord(raw)) return fail(`Упражнение №${i + 1}: неверный формат`);
    if (typeof raw.name !== 'string' || raw.name.trim() === '') {
      return fail(`Упражнение №${i + 1}: пустое название`);
    }
    const name = raw.name.trim();
    if (name.length > NAME_MAX_LENGTH) return fail(`Упражнение «${name.slice(0, 20)}…»: слишком длинное название`);
    if (typeof raw.setsText !== 'string') return fail(`Упражнение «${name}»: не указаны подходы`);

    const parsed = parseSetsLine(raw.setsText);
    if (!parsed.ok) return fail(`Упражнение «${name}»: ${parsed.error}`);
    exercises.push({ name, sets: parsed.sets });
  }

  // --- Кардио ---
  if (!Array.isArray(body.cardio)) return fail('Поле cardio должно быть массивом');
  const cardio: NormalizedWorkoutInput['cardio'] = [];
  for (let i = 0; i < body.cardio.length; i++) {
    const raw = body.cardio[i];
    if (!isRecord(raw)) return fail(`Кардио №${i + 1}: неверный формат`);
    if (typeof raw.activity !== 'string' || !CARDIO_ACTIVITIES.includes(raw.activity as CardioActivity)) {
      return fail(`Кардио №${i + 1}: некорректная активность`);
    }
    const distance = optionalPositiveNumber(raw.distanceKm, `Кардио №${i + 1}: дистанция`);
    if (!distance.ok) return fail(distance.error);
    const heartRate = optionalPositiveInt(raw.avgHeartRate, `Кардио №${i + 1}: пульс`);
    if (!heartRate.ok) return fail(heartRate.error);
    const incline = optionalNonNegativeNumber(raw.inclinePercent, `Кардио №${i + 1}: уклон`);
    if (!incline.ok) return fail(incline.error);

    // Темп считаем из длительности тренировки и дистанции — как при создании.
    const avgPace = duration.value != null ? computeAvgPace(duration.value, distance.value) : null;

    cardio.push({
      activity: raw.activity as CardioActivity,
      distanceKm: distance.value,
      avgHeartRate: heartRate.value,
      avgPace,
      inclinePercent: incline.value,
    });
  }

  return {
    ok: true,
    value: {
      fields: {
        date: parsedDate.toISOString(),
        type,
        durationMinutes: duration.value,
        warmupMinutes: warmup.value,
        notes,
      },
      exercises,
      cardio,
    },
  };
}
