import { Telegraf, Context } from 'telegraf';
import { WorkoutType } from '../../types/domain';
import { getDraft, startDraft, clearDraft, canAddCardio, DRAFT_CANCELLED_TEXT } from './state';
import { otherActiveFlow, activeFlowBlockedMessage } from '../activeFlow';
import { typeKeyboard, dateKeyboard, resumeOrRestartKeyboard, exerciseSavedMenuKeyboard } from './keyboards';
import { getUserTimezone } from '../../db/profiles';
import { addDays, localNow } from '../../utils/time';
import { parseDayMonth } from '../../utils/parse';
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
import { saveDraftWorkout, FinishResult } from './finish';
import { Markup } from 'telegraf';
import {
  renderTemplatePicker,
  renderTemplatePreview,
  handleTemplateChosen,
  handleTemplateEditExercise,
  handleTemplateSetsEntered,
  handleTemplateRemoveExercise,
  handleTemplateEditCardio,
  handleTemplateCardioEntered,
  handleTemplateAddExercise,
} from '../templates/flow';

// Под сообщением «Тренировка сохранена» — предложение сохранить её как свой шаблон.
function finishKeyboard(result: FinishResult) {
  if (!result.ok || !result.canSaveAsTemplate) return undefined;
  return Markup.inlineKeyboard([[Markup.button.callback('💾 Сохранить как шаблон', `tpl:new:${result.workoutId}`)]])
    .reply_markup;
}

export async function handleNewWorkoutCommand(ctx: Context): Promise<void> {
  await startNewWorkout(ctx);
}

// Новая тренировка за конкретную прошлую дату (например, «➕ Тренировка за вчера» из утреннего обзора).
export async function handleNewWorkoutForDate(ctx: Context, dateStr: string): Promise<void> {
  await startNewWorkout(ctx, dateStr);
}

async function startNewWorkout(ctx: Context, dateStr?: string): Promise<void> {
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

  const conflict = otherActiveFlow(userId, 'draft');
  if (conflict) {
    await ctx.reply(activeFlowBlockedMessage(conflict));
    return;
  }

  const draft = startDraft(userId, chatId);
  draft.date = dateStr;
  await renderTemplatePicker(ctx, userId, false);
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
  await ctx.reply(result.text, { reply_markup: finishKeyboard(result) });
}

async function handleFinishAction(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  const result = await saveDraftWorkout(userId);
  await ctx.editMessageText(result.text, { reply_markup: finishKeyboard(result) });
}

// Перерисовывает текущий шаг незавершённой тренировки в это же сообщение —
// чтобы "Продолжить" не отправляло пользователя искать клавиатуру в старых сообщениях.
async function renderCurrentStep(ctx: Context, userId: number): Promise<void> {
  const draft = getDraft(userId);
  if (!draft) return;

  switch (draft.step) {
    case 'choosing_template':
      await renderTemplatePicker(ctx, userId, true);
      return;
    case 'reviewing_template':
    case 'editing_template_exercise':
    case 'editing_template_cardio':
      await renderTemplatePreview(ctx, userId, true);
      return;
    case 'choosing_type':
      await ctx.editMessageText(typePromptText(draft.date), { reply_markup: typeKeyboard() });
      return;
    case 'choosing_date':
      await ctx.editMessageText(DATE_PROMPT, { reply_markup: dateKeyboard() });
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
  await ctx.editMessageText(DRAFT_CANCELLED_TEXT);
}

async function handleRestartAction(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  clearDraft(userId);
  startDraft(userId, chatId);
  await renderTemplatePicker(ctx, userId, true);
}

const DATE_PROMPT = '📅 За какой день записать тренировку? Выбери кнопкой или напиши дату дд.мм:';

function typePromptText(date?: string): string {
  if (!date) return 'Выбери тип тренировки:';
  const [, m, d] = date.split('-');
  return `📅 ${d}.${m} · Выбери тип тренировки:`;
}

// Дата выбрана — возвращаемся к выбору шаблона (он показывает выбранную дату).
async function applyChosenDate(ctx: Context, userId: number, dateStr: string | undefined, viaEdit: boolean): Promise<void> {
  const draft = getDraft(userId);
  if (!draft) return;
  draft.date = dateStr;
  await renderTemplatePicker(ctx, userId, viaEdit);
}

export function registerWorkout(bot: Telegraf): void {
  bot.command('new_workout', handleNewWorkoutCommand);
  bot.command('done', handleDoneCommand);

  bot.action('w:date', async (ctx) => {
    await ctx.answerCbQuery();
    const draft = getDraft(ctx.from.id);
    if (!draft) return;
    draft.step = 'choosing_date';
    await ctx.editMessageText(DATE_PROMPT, { reply_markup: dateKeyboard() });
  });

  bot.action('w:scratch', async (ctx) => {
    await ctx.answerCbQuery();
    const draft = getDraft(ctx.from.id);
    if (!draft) return;
    draft.step = 'choosing_type';
    await ctx.editMessageText(typePromptText(draft.date), { reply_markup: typeKeyboard() });
  });

  bot.action(/^tp:use:([0-9a-f-]{36})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const draft = getDraft(ctx.from.id);
    if (!draft || draft.step !== 'choosing_template') return;
    await handleTemplateChosen(ctx, ctx.match[1]);
  });

  bot.action(/^tp:ed:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleTemplateEditExercise(ctx, Number(ctx.match[1]));
  });

  bot.action(/^tp:rm:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleTemplateRemoveExercise(ctx, Number(ctx.match[1]));
  });

  bot.action('tp:cardio', async (ctx) => {
    await ctx.answerCbQuery();
    await handleTemplateEditCardio(ctx);
  });

  bot.action('tp:add', async (ctx) => {
    await ctx.answerCbQuery();
    await handleTemplateAddExercise(ctx);
  });

  bot.action(/^w:date:([0-2])$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const back = Number(ctx.match[1]);
    const today = localNow(await getUserTimezone(userId)).dateStr;
    await applyChosenDate(ctx, userId, back === 0 ? undefined : addDays(today, -back), true);
  });

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

    if (draft.step === 'editing_template_exercise') {
      await handleTemplateSetsEntered(ctx, text);
      return;
    }

    if (draft.step === 'editing_template_cardio') {
      await handleTemplateCardioEntered(ctx, text);
      return;
    }

    if (draft.step === 'choosing_date') {
      const today = localNow(await getUserTimezone(draft.userId)).dateStr;
      const parsed = parseDayMonth(text, today);
      if (!parsed.ok) {
        await ctx.reply(parsed.error);
        return;
      }
      await applyChosenDate(ctx, draft.userId, parsed.dateStr === today ? undefined : parsed.dateStr, false);
      return;
    }

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
