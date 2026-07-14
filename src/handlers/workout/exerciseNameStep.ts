import { Context, Markup } from 'telegraf';
import { MuscleGroup } from '../../types/domain';
import { getDraft, setStep, canAddCardio } from './state';
import { getLastExercisesByUser } from '../../db/exercises';
import { getCatalogByGroup, getUserCustomExercises, addCustomExerciseToCatalog } from '../../db/exerciseCatalog';
import {
  enteringSetsKeyboard,
  exerciseNameKeyboard,
  muscleGroupKeyboard,
  groupExerciseKeyboard,
} from './keyboards';

export async function promptSetsForExercise(ctx: Context, name: string, viaEdit: boolean): Promise<void> {
  const text = `${name}. Введи подходы одной строкой, например:\n40x12, 40x12, 42.5x10`;
  const reply_markup = enteringSetsKeyboard();

  if (viaEdit) {
    await ctx.editMessageText(text, { reply_markup });
  } else {
    await ctx.reply(text, { reply_markup });
  }
}

// Рендерит исходный экран выбора упражнения (последние названия + доступ к справочнику).
export async function renderExerciseMenu(
  ctx: Context,
  userId: number,
  viaEdit = true,
  prefixText = ''
): Promise<void> {
  const draft = getDraft(userId);
  if (!draft) return;

  setStep(userId, 'choosing_exercise_name');
  const recentNames = await getLastExercisesByUser(userId, 6);
  draft.recentExerciseNames = recentNames;

  const text =
    prefixText +
    (recentNames.length > 0
      ? 'Выбери упражнение из последних или введи новое:'
      : 'Выбери упражнение из справочника или введи своё:');
  const reply_markup = exerciseNameKeyboard(recentNames, canAddCardio(draft));

  if (viaEdit) {
    await ctx.editMessageText(text, { reply_markup });
  } else {
    await ctx.reply(text, { reply_markup });
  }
}

export async function handleExerciseChosenByIndex(ctx: Context, index: number): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  const name = draft.recentExerciseNames?.[index];
  if (!name) {
    await ctx.answerCbQuery('Не нашёл это упражнение, попробуй ещё раз');
    return;
  }

  draft.currentExerciseName = name;
  setStep(userId, 'entering_sets');
  await promptSetsForExercise(ctx, name, true);
}

export async function handleShowAllExercises(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  setStep(userId, 'choosing_muscle_group');
  await ctx.editMessageText('Выбери группу мышц:', { reply_markup: muscleGroupKeyboard() });
}

export async function handleMuscleGroupChosen(ctx: Context, group: MuscleGroup | 'mine'): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  const names = group === 'mine' ? await getUserCustomExercises(userId) : await getCatalogByGroup(userId, group);
  draft.groupExerciseNames = names;
  setStep(userId, 'choosing_exercise_in_group');

  if (names.length === 0) {
    await ctx.editMessageText('Пока пусто. Добавь упражнение через «✏️ Ввести своё название».', {
      reply_markup: groupExerciseKeyboard([]),
    });
    return;
  }

  await ctx.editMessageText('Выбери упражнение:', { reply_markup: groupExerciseKeyboard(names) });
}

// Восстанавливает экран выбора упражнения внутри группы мышц при "Продолжить тренировку" —
// использует уже закэшированный в драфте список, не перезапрашивая группу у БД.
export async function renderExerciseInGroupResume(ctx: Context, userId: number): Promise<void> {
  const draft = getDraft(userId);
  if (!draft) return;

  const names = draft.groupExerciseNames ?? [];

  if (names.length === 0) {
    await ctx.editMessageText('Пока пусто. Добавь упражнение через «✏️ Ввести своё название».', {
      reply_markup: groupExerciseKeyboard([]),
    });
    return;
  }

  await ctx.editMessageText('Выбери упражнение:', { reply_markup: groupExerciseKeyboard(names) });
}

export async function handleExerciseChosenFromGroup(ctx: Context, index: number): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  const name = draft.groupExerciseNames?.[index];
  if (!name) {
    await ctx.answerCbQuery('Не нашёл это упражнение, попробуй ещё раз');
    return;
  }

  draft.currentExerciseName = name;
  setStep(userId, 'entering_sets');
  await promptSetsForExercise(ctx, name, true);
}

export async function handleBackToMuscleGroups(ctx: Context): Promise<void> {
  await handleShowAllExercises(ctx);
}

export async function handleBackToExerciseMenu(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await renderExerciseMenu(ctx, userId, true);
}

export async function handleCustomExercisePrompt(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  setStep(userId, 'entering_custom_exercise_name');
  await ctx.editMessageText('Введи название упражнения:', {
    reply_markup: Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'w:back_to_exercise_menu')]])
      .reply_markup,
  });
}

export async function handleCustomExerciseNameEntered(ctx: Context, name: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    await ctx.reply('Название должно быть от 1 до 100 символов. Введи ещё раз:');
    return;
  }

  await addCustomExerciseToCatalog(userId, trimmed);

  draft.currentExerciseName = trimmed;
  setStep(userId, 'entering_sets');
  await promptSetsForExercise(ctx, trimmed, false);
}
