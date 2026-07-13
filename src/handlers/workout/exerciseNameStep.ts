import { Context } from 'telegraf';
import { getDraft, setStep } from './state';
import { enteringSetsKeyboard } from './keyboards';

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

  await ctx.editMessageText(
    `${name}. Введи подходы одной строкой, например:\n40x12, 40x12, 42.5x10`,
    { reply_markup: enteringSetsKeyboard() }
  );
}

export async function handleCustomExercisePrompt(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  setStep(userId, 'entering_custom_exercise_name');
  await ctx.editMessageText('Введи название упражнения:');
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

  draft.currentExerciseName = trimmed;
  setStep(userId, 'entering_sets');

  await ctx.reply(
    `${trimmed}. Введи подходы одной строкой, например:\n40x12, 40x12, 42.5x10`,
    { reply_markup: enteringSetsKeyboard() }
  );
}
