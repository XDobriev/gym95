import { Telegraf, Context } from 'telegraf';
import { WorkoutType } from '../../types/domain';
import { getDraft, startDraft, clearDraft } from './state';
import { typeKeyboard, resumeOrRestartKeyboard } from './keyboards';
import { handleTypeChosen, handleWarmupMinutesEntered, handleWarmupSkip } from './typeStep';
import {
  handleExerciseChosenByIndex,
  handleCustomExercisePrompt,
  handleCustomExerciseNameEntered,
  handleShowAllExercises,
  handleMuscleGroupChosen,
  handleExerciseChosenFromGroup,
  handleBackToMuscleGroups,
  handleBackToExerciseMenu,
} from './exerciseNameStep';
import {
  handleSetsTextEntered,
  handleAddMoreSets,
  handleRepeatLast,
  handleNextExercise,
  handleCancelExercise,
} from './setsInputStep';
import {
  promptCardioActivity,
  handleCardioActivityChosen,
  handleCardioDurationEntered,
  handleCardioDurationDefault,
  handleCardioDistanceEntered,
  handleCardioDistanceSkip,
  handleCardioInclineEntered,
  handleCardioInclineSkip,
  handleCardioPulseEntered,
  handleCardioPulseSkip,
  handleCardioCancel,
} from './cardioStep';
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

  bot.action('w:all_exercises', async (ctx) => {
    await ctx.answerCbQuery();
    await handleShowAllExercises(ctx);
  });

  bot.action(/^w:muscle_group:(chest|back|legs|shoulders|arms|abs|mine)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleMuscleGroupChosen(ctx, ctx.match[1] as Parameters<typeof handleMuscleGroupChosen>[1]);
  });

  bot.action(/^w:group_ex:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleExerciseChosenFromGroup(ctx, parseInt(ctx.match[1], 10));
  });

  bot.action('w:back_to_exercise_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await handleBackToExerciseMenu(ctx);
  });

  bot.action('w:muscle_group_back', async (ctx) => {
    await ctx.answerCbQuery();
    await handleBackToMuscleGroups(ctx);
  });

  bot.action('w:warmup_skip', async (ctx) => {
    await ctx.answerCbQuery();
    await handleWarmupSkip(ctx);
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

  bot.action('w:add_cardio', async (ctx) => {
    await ctx.answerCbQuery();
    await promptCardioActivity(ctx);
  });

  bot.action(/^w:cardio_activity:(treadmill|bike|running|walking)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleCardioActivityChosen(ctx, ctx.match[1] as 'treadmill' | 'bike' | 'running' | 'walking');
  });

  bot.action('w:cardio_duration_default', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCardioDurationDefault(ctx);
  });

  bot.action('w:cardio_skip_distance', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCardioDistanceSkip(ctx);
  });

  bot.action('w:cardio_skip_incline', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCardioInclineSkip(ctx);
  });

  bot.action('w:cardio_skip_pulse', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCardioPulseSkip(ctx);
  });

  bot.action('w:cardio_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCardioCancel(ctx);
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

    if (draft.step === 'entering_warmup') {
      await handleWarmupMinutesEntered(ctx, text);
      return;
    }

    if (draft.step === 'entering_custom_exercise_name') {
      await handleCustomExerciseNameEntered(ctx, text);
      return;
    }

    if (draft.step === 'entering_sets') {
      await handleSetsTextEntered(ctx, text);
      return;
    }

    if (draft.step === 'entering_cardio_duration') {
      await handleCardioDurationEntered(ctx, text);
      return;
    }

    if (draft.step === 'entering_cardio_distance') {
      await handleCardioDistanceEntered(ctx, text);
      return;
    }

    if (draft.step === 'entering_cardio_incline') {
      await handleCardioInclineEntered(ctx, text);
      return;
    }

    if (draft.step === 'entering_cardio_pulse') {
      await handleCardioPulseEntered(ctx, text);
      return;
    }

    return next();
  });
}
