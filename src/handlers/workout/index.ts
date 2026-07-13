import { Telegraf, Context } from 'telegraf';
import { WorkoutType } from '../../types/domain';
import { getDraft, startDraft, clearDraft } from './state';
import { typeKeyboard, resumeOrRestartKeyboard } from './keyboards';
import { handleTypeChosen } from './typeStep';
import {
  handleExerciseChosenByIndex,
  handleCustomExercisePrompt,
  handleCustomExerciseNameEntered,
} from './exerciseNameStep';
import {
  handleSetsTextEntered,
  handleAddMoreSets,
  handleRepeatLast,
  handleNextExercise,
  handleCancelExercise,
} from './setsInputStep';
import { saveDraftWorkout } from './finish';

async function handleNewWorkoutCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const existing = getDraft(userId);
  if (existing) {
    await ctx.reply(
      'У тебя уже есть незавершённая тренировка. Продолжить её или начать заново?',
      { reply_markup: resumeOrRestartKeyboard() }
    );
    return;
  }

  startDraft(userId, chatId);
  await ctx.reply('Выбери тип тренировки:', { reply_markup: typeKeyboard() });
}

async function handleDoneCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) {
    await ctx.reply('Нет активной тренировки. Начни с /new_workout');
    return;
  }

  const result = await saveDraftWorkout(userId);
  await ctx.reply(result.text);
}

async function handleFinishAction(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  const result = await saveDraftWorkout(userId);
  await ctx.editMessageText(result.text);
}

async function handleResumeAction(ctx: Context): Promise<void> {
  await ctx.editMessageText('Продолжаем. Используй кнопки на предыдущих сообщениях или /done чтобы завершить.');
}

async function handleRestartAction(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  clearDraft(userId);
  startDraft(userId, chatId);
  await ctx.editMessageText('Начинаем заново. Выбери тип тренировки:', { reply_markup: typeKeyboard() });
}

export function registerWorkout(bot: Telegraf): void {
  bot.command('new_workout', handleNewWorkoutCommand);
  bot.command('done', handleDoneCommand);

  bot.action(/^w:type:(cardio|strength|pool|mixed)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const type = ctx.match[1] as WorkoutType;
    await handleTypeChosen(ctx, type);
  });

  bot.action(/^w:ex:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleExerciseChosenByIndex(ctx, parseInt(ctx.match[1], 10));
  });

  bot.action('w:ex:custom', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCustomExercisePrompt(ctx);
  });

  bot.action('w:add_more_sets', async (ctx) => {
    await ctx.answerCbQuery();
    await handleAddMoreSets(ctx);
  });

  bot.action('w:repeat_last', async (ctx) => {
    await ctx.answerCbQuery();
    await handleRepeatLast(ctx);
  });

  bot.action('w:next_exercise', async (ctx) => {
    await ctx.answerCbQuery();
    await handleNextExercise(ctx);
  });

  bot.action('w:cancel_exercise', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCancelExercise(ctx);
  });

  bot.action('w:finish', async (ctx) => {
    await ctx.answerCbQuery();
    await handleFinishAction(ctx);
  });

  bot.action('w:resume', async (ctx) => {
    await ctx.answerCbQuery();
    await handleResumeAction(ctx);
  });

  bot.action('w:restart', async (ctx) => {
    await ctx.answerCbQuery();
    await handleRestartAction(ctx);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from?.id;
    const draft = userId ? getDraft(userId) : undefined;

    if (!draft) {
      return next();
    }

    const text = 'text' in ctx.message ? ctx.message.text : '';

    if (draft.step === 'entering_custom_exercise_name') {
      await handleCustomExerciseNameEntered(ctx, text);
      return;
    }

    if (draft.step === 'entering_sets') {
      await handleSetsTextEntered(ctx, text);
      return;
    }

    return next();
  });
}
