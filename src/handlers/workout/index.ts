import { Telegraf, Context } from 'telegraf';
import { WorkoutType } from '../../types/domain';
import { getDraft, startDraft, clearDraft, canAddCardio } from './state';
import { typeKeyboard, resumeOrRestartKeyboard, exerciseSavedMenuKeyboard } from './keyboards';
import { handleTypeChosen, handleWarmupMinutesEntered, handleWarmupSkip, renderWarmupPrompt } from './typeStep';
import {
  handleExerciseChosenByIndex,
  handleCustomExercisePrompt,
  handleCustomExerciseNameEntered,
  handleShowAllExercises,
  handleMuscleGroupChosen,
  handleExerciseChosenFromGroup,
  handleBackToMuscleGroups,
  handleBackToExerciseMenu,
  renderExerciseMenu,
  renderExerciseInGroupResume,
  promptSetsForExercise,
} from './exerciseNameStep';
import {
  handleSetsTextEntered,
  handleAddMoreSets,
  handleRepeatLast,
  handleNextExercise,
  handleCancelExercise,
  renderExerciseSavedMenu,
  promptMoreSetsForExercise,
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
  renderCardioDurationResume,
  proceedAfterDuration,
  askForIncline,
  askForPulse,
  finalizeCardioBlock,
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

// Перерисовывает текущий шаг незавершённой тренировки в это же сообщение —
// чтобы "Продолжить" не отправляло пользователя искать клавиатуру в старых сообщениях.
async function renderCurrentStep(ctx: Context, userId: number): Promise<void> {
  const draft = getDraft(userId);
  if (!draft) return;

  switch (draft.step) {
    case 'choosing_type':
      await ctx.editMessageText('Выбери тип тренировки:', { reply_markup: typeKeyboard() });
      return;
    case 'entering_warmup':
      await renderWarmupPrompt(ctx);
      return;
    case 'choosing_exercise_name':
      await renderExerciseMenu(ctx, userId, true);
      return;
    case 'choosing_muscle_group':
      await handleShowAllExercises(ctx);
      return;
    case 'choosing_exercise_in_group':
      await renderExerciseInGroupResume(ctx, userId);
      return;
    case 'entering_custom_exercise_name':
      await handleCustomExercisePrompt(ctx);
      return;
    case 'entering_sets':
      if (!draft.currentExerciseName) return;
      if (draft.appendToLastExercise) {
        await promptMoreSetsForExercise(ctx, draft.currentExerciseName);
      } else {
        await promptSetsForExercise(ctx, draft.currentExerciseName, true);
      }
      return;
    case 'exercise_saved_menu':
      await ctx.editMessageText(renderExerciseSavedMenu(draft), {
        reply_markup: exerciseSavedMenuKeyboard(canAddCardio(draft)),
      });
      return;
    case 'choosing_cardio_activity':
      await promptCardioActivity(ctx);
      return;
    case 'entering_cardio_duration':
      await renderCardioDurationResume(ctx, userId);
      return;
    case 'entering_cardio_distance':
      await proceedAfterDuration(ctx, userId, true);
      return;
    case 'entering_cardio_incline':
      await askForIncline(ctx, userId, true);
      return;
    case 'entering_cardio_pulse':
      await askForPulse(ctx, userId, true);
      return;
    case 'cardio_saved_menu':
      await finalizeCardioBlock(ctx, userId, true);
      return;
    default:
      return;
  }
}

async function handleResumeAction(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await renderCurrentStep(ctx, userId);
}

async function handleCancelWorkoutAction(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  clearDraft(userId);
  await ctx.editMessageText('Тренировка отменена — в ней ничего не сохранено. Начни заново — /new_workout');
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

  bot.action('w:cancel_workout', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCancelWorkoutAction(ctx);
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
