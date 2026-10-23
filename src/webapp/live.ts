import { supabase } from '../db/client';
import { createWorkout } from '../db/workouts';
import { addExercise, getExercisesByWorkoutId } from '../db/exercises';
import { listTemplates, createTemplate } from '../db/templates';
import { getExerciseNames } from './queries';
import { calculate1RM } from '../utils/oneRepMax';
import {
  SaveLiveWorkoutRequest,
  SaveLiveWorkoutResponse,
  LiveContextResponse,
  NewPersonalRecord,
  LiveExerciseInput,
} from '../types/webapp';
import { calculateSessionVolume } from '../utils/liveWorkout';

export function validateLiveWorkoutPayload(
  body: unknown
): { ok: true; data: SaveLiveWorkoutRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Тело запроса должно быть объектом' };
  }

  const raw = body as Partial<SaveLiveWorkoutRequest>;

  const durationMinutes =
    typeof raw.durationMinutes === 'number' && raw.durationMinutes > 0
      ? Math.round(raw.durationMinutes)
      : null;

  if (durationMinutes === null) {
    return { ok: false, error: 'Укажите длительность тренировки в минутах' };
  }

  if (!Array.isArray(raw.exercises) || raw.exercises.length === 0) {
    return { ok: false, error: 'В тренировке должно быть хотя бы одно упражнение' };
  }

  const filteredExercises: LiveExerciseInput[] = [];

  for (const ex of raw.exercises) {
    if (!ex || typeof ex.name !== 'string' || !ex.name.trim()) continue;
    if (!Array.isArray(ex.sets)) continue;

    const completedSets = ex.sets
      .filter((s) => s && s.completed && typeof s.reps === 'number' && s.reps > 0)
      .map((s) => ({
        weight: typeof s.weight === 'number' && s.weight >= 0 ? s.weight : 0,
        reps: Math.round(s.reps),
        completed: true,
      }));

    if (completedSets.length > 0) {
      filteredExercises.push({
        name: ex.name.trim(),
        sets: completedSets,
      });
    }
  }

  if (filteredExercises.length === 0) {
    return { ok: false, error: 'Нет завершённых подходов для сохранения' };
  }

  return {
    ok: true,
    data: {
      durationMinutes,
      warmupMinutes:
        typeof raw.warmupMinutes === 'number' && raw.warmupMinutes > 0
          ? Math.round(raw.warmupMinutes)
          : undefined,
      notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : undefined,
      templateId: typeof raw.templateId === 'string' && raw.templateId ? raw.templateId : undefined,
      saveAsTemplateName:
        typeof raw.saveAsTemplateName === 'string' && raw.saveAsTemplateName.trim()
          ? raw.saveAsTemplateName.trim()
          : undefined,
      exercises: filteredExercises,
    },
  };
}

export async function getLiveContext(userId: number): Promise<LiveContextResponse> {
  // 1. Последняя силовая тренировка для кнопки «Повторить» и ghost values
  const { data: recentWorkouts, error: wError } = await supabase
    .from('workouts')
    .select('id, date, type')
    .eq('user_id', userId)
    .eq('type', 'strength')
    .order('date', { ascending: false })
    .limit(1);

  if (wError) throw new Error(`getLiveContext/workouts: ${wError.message}`);

  let lastWorkout: LiveContextResponse['lastWorkout'] = null;
  if (recentWorkouts && recentWorkouts.length > 0) {
    const rawLast = recentWorkouts[0];
    const exercises = await getExercisesByWorkoutId(rawLast.id);
    lastWorkout = {
      id: rawLast.id,
      date: rawLast.date,
      type: rawLast.type,
      exercises: exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
      })),
    };
  }

  // 2. Шаблоны пользователя и общие программы
  const rawTemplates = await listTemplates(userId).catch(() => []);
  const templates = rawTemplates
    .filter((t) => t.type === 'strength' || t.type === 'mixed')
    .map((t) => ({
      id: t.id,
      name: t.name,
      exercises: t.exercises.map((e) => ({
        name: e.name,
        defaultSetsCount: e.sets?.length || 3,
      })),
    }));

  // 3. Каталог частых упражнений для поиска
  const commonExercises = await getExerciseNames(userId, 60).catch(() => []);

  return {
    lastWorkout,
    templates,
    commonExercises,
  };
}

export async function saveLiveWorkout(
  userId: number,
  body: unknown
): Promise<SaveLiveWorkoutResponse> {
  const validated = validateLiveWorkoutPayload(body);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const { durationMinutes, warmupMinutes, notes, templateId, saveAsTemplateName, exercises } =
    validated.data;

  // Создаём тренировку в базе
  const workout = await createWorkout({
    userId,
    type: 'strength',
    durationMinutes,
    warmupMinutes,
    notes,
    templateId,
  });

  // Добавляем выполненные упражнения и подходы
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    await addExercise({
      workoutId: workout.id,
      name: ex.name,
      sets: ex.sets.map((s) => ({ weight: s.weight, reps: s.reps })),
      orderIndex: i,
    });
  }

  // Если пользователь выбрал сохранить как шаблон
  if (saveAsTemplateName) {
    try {
      await createTemplate({
        userId,
        name: saveAsTemplateName,
        type: 'strength',
        exercises: exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets.map((s) => ({ weight: s.weight, reps: s.reps })),
        })),
        cardio: null,
      });
    } catch (err) {
      console.warn('Не удалось сохранить шаблон из Live Workout:', err);
    }
  }

  // Суммарный тоннаж
  const totalVolume = calculateSessionVolume(exercises);
  const newPrs: NewPersonalRecord[] = [];

  // Вычисляем новые рекорды 1RM
  for (const ex of exercises) {
    let sessionBest1RM = 0;
    let bestSet = { weight: 0, reps: 0 };
    for (const s of ex.sets) {
      if (s.weight > 0 && s.reps > 0) {
        const set1RM = calculate1RM(s.weight, s.reps);
        if (set1RM > sessionBest1RM) {
          sessionBest1RM = set1RM;
          bestSet = { weight: s.weight, reps: s.reps };
        }
      }
    }

    if (sessionBest1RM > 0) {
      const { data: pastExData } = await supabase
        .from('exercises')
        .select('sets, workouts!inner(user_id, id)')
        .eq('workouts.user_id', userId)
        .neq('workouts.id', workout.id)
        .ilike('name', ex.name);

      let prevBest1RM = 0;
      if (pastExData) {
        for (const row of pastExData) {
          const pastSets = (row.sets ?? []) as { weight: number; reps: number }[];
          for (const ps of pastSets) {
            if (ps.weight > 0 && ps.reps > 0) {
              const r = calculate1RM(ps.weight, ps.reps);
              if (r > prevBest1RM) prevBest1RM = r;
            }
          }
        }
      }

      if (prevBest1RM > 0 && sessionBest1RM > prevBest1RM) {
        newPrs.push({
          exercise: ex.name,
          weight: bestSet.weight,
          reps: bestSet.reps,
          oneRepMax: sessionBest1RM,
          prevOneRepMax: prevBest1RM,
        });
      }
    }
  }

  const summaryText = `Силовая тренировка: ${durationMinutes} мин, ${exercises.length} упр., тоннаж ${totalVolume} кг.`;

  return {
    ok: true,
    workoutId: workout.id,
    newPrs,
    summaryText,
  };
}
