import { Context } from 'telegraf';
import { DraftWorkout } from '../../types/draft';
import { getDraft, setStep } from './state';
import { parseSetsLine } from '../../utils/setsParser';
import { formatSetsInline } from '../../utils/format';
import { enteringSetsKeyboard, exerciseSavedMenuKeyboard, exerciseNameKeyboard } from './keyboards';
import { getLastExercisesByUser } from '../../db/exercises';

function renderExerciseSavedMenu(draft: DraftWorkout): string {
  const lines = draft.exercises.map(
    (ex, i) => `${i + 1}. ${ex.name} — ${ex.sets.length} подход(ов)`
  );

  const lastExercise = draft.exercises[draft.exercises.length - 1];
  const header = `✅ ${lastExercise.name}: ${formatSetsInline(lastExercise.sets)}`;

  return [header, '', 'Внесено в тренировку:', ...lines].join('\n');
}

function upsertCurrentExercise(
  draft: DraftWorkout,
  name: string,
  newSets: { weight: number; reps: number }[]
): void {
  const lastExercise = draft.exercises[draft.exercises.length - 1];

  if (draft.appendToLastExercise && lastExercise && lastExercise.name === name) {
    lastExercise.sets.push(...newSets);
  } else {
    draft.exercises.push({ name, sets: newSets, orderIndex: draft.exercises.length });
  }

  draft.appendToLastExercise = false;
}

export async function handleSetsTextEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.currentExerciseName) return;

  const result = parseSetsLine(text);

  if (!result.ok) {
    await ctx.reply(result.error, { reply_markup: enteringSetsKeyboard() });
    return;
  }

  upsertCurrentExercise(draft, draft.currentExerciseName, result.sets);
  setStep(userId, 'exercise_saved_menu');

  await ctx.reply(renderExerciseSavedMenu(draft), { reply_markup: exerciseSavedMenuKeyboard() });
}

export async function handleAddMoreSets(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || draft.exercises.length === 0) return;

  const lastExercise = draft.exercises[draft.exercises.length - 1];
  draft.currentExerciseName = lastExercise.name;
  draft.appendToLastExercise = true;
  setStep(userId, 'entering_sets');

  await ctx.editMessageText(
    `${lastExercise.name}. Введи ещё подходы, например:\n40x12, 40x12`,
    { reply_markup: enteringSetsKeyboard() }
  );
}

export async function handleRepeatLast(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || draft.exercises.length === 0) return;

  const lastExercise = draft.exercises[draft.exercises.length - 1];
  const lastSet = lastExercise.sets[lastExercise.sets.length - 1];
  if (!lastSet) return;

  lastExercise.sets.push({ ...lastSet });

  await ctx.editMessageText(renderExerciseSavedMenu(draft), { reply_markup: exerciseSavedMenuKeyboard() });
}

export async function handleNextExercise(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  draft.currentExerciseName = undefined;
  draft.appendToLastExercise = false;
  setStep(userId, 'choosing_exercise_name');

  const recentNames = await getLastExercisesByUser(userId, 6);
  draft.recentExerciseNames = recentNames;

  await ctx.editMessageText('Выбери следующее упражнение или введи новое:', {
    reply_markup: exerciseNameKeyboard(recentNames),
  });
}

export async function handleCancelExercise(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  draft.currentExerciseName = undefined;
  draft.appendToLastExercise = false;
  setStep(userId, 'choosing_exercise_name');

  await ctx.editMessageText('Ок, отменил. Выбери упражнение:', {
    reply_markup: exerciseNameKeyboard(draft.recentExerciseNames ?? []),
  });
}
