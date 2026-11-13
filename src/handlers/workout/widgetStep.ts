import { Context, Markup } from 'telegraf';
import { DraftWorkout } from '../../types/draft';
import { getDraft, setStep, canAddCardio } from './state';
import {
  sendWidget,
  editMessageWidgetData,
  answerWidgetQuery,
  serializeWidgetData,
  WidgetQueryData,
  parseWidgetQueryPayload,
  LiveWorkoutWidgetState,
} from '../../utils/telegramWidgets';
import { generateLiveWorkoutWidgetHtml } from '../../templates/liveWorkoutWidget';
import { promptSetsForExercise } from './exerciseNameStep';
import { renderExerciseSavedMenu } from './setsInputStep';
import { exerciseSavedMenuKeyboard, exerciseNameKeyboard } from './keyboards';
import { saveDraftWorkout } from './finish';
import { getLastExercisesByUser } from '../../db/exercises';

/**
 * Attempts to send an interactive Live Workout HTML widget for the chosen exercise.
 * If Telegram API / client doesn't support Bot API 10.4 widgets, gracefully falls
 * back to the standard inline keyboard prompt (promptSetsForExercise).
 */
export async function sendExerciseWidget(
  ctx: Context,
  exerciseName: string,
  viaEdit: boolean = false
): Promise<boolean> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return false;

  const draft = getDraft(userId);
  if (!draft) return false;

  // If user or environment has disabled widgets, fallback immediately
  if (draft.useWidget === false) {
    await promptSetsForExercise(ctx, exerciseName, viaEdit);
    return false;
  }

  // Check if exercise already has logged sets in draft
  const existingExercise = draft.exercises.find((ex) => ex.name === exerciseName);
  const currentSets = existingExercise?.sets ?? [];
  const setNumber = currentSets.length + 1;
  const lastSet = currentSets[currentSets.length - 1];

  const suggestedWeight = draft.progressHints?.[exerciseName];
  const defaultWeight = lastSet?.weight ?? suggestedWeight ?? 50;
  const defaultReps = lastSet?.reps ?? 10;

  const widgetState: LiveWorkoutWidgetState = {
    wid: draft.templateId || `w_${userId}_${Date.now()}`,
    ex: exerciseName,
    sn: setNumber,
    st: 4,
    w: defaultWeight,
    r: defaultReps,
    pw: lastSet?.weight,
    pr: lastSet?.reps,
    m: 'active',
    rd: 90,
    completedSets: currentSets.map((s) => ({ w: s.weight, r: s.reps })),
  };

  const html = generateLiveWorkoutWidgetHtml({
    initialState: widgetState,
    title: exerciseName,
  });

  const chat_data = serializeWidgetData(widgetState);

  try {
    const res = await sendWidget(ctx.telegram, {
      chat_id: chatId,
      html,
      chat_data,
    });

    if (viaEdit) {
      await ctx.deleteMessage().catch(() => {});
    }

    draft.widgetMessageId = res?.message_id;
    draft.currentExerciseName = exerciseName;
    setStep(userId, 'entering_sets');
    return true;
  } catch (err: any) {
    // Graceful fallback to inline keyboard prompt
    draft.useWidget = false;
    await promptSetsForExercise(ctx, exerciseName, viaEdit);
    return false;
  }
}

/**
 * Handles incoming widget_query update from Telegram Bot API 10.4
 */
export async function handleWidgetQuery(ctx: Context, query: WidgetQueryData): Promise<void> {
  const userId = query.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) {
    await answerWidgetQuery(ctx.telegram, {
      widget_query_id: query.id,
      text: 'Нет активной тренировки. Начни с /new_workout',
      show_alert: true,
    }).catch(() => {});
    return;
  }

  const payload = parseWidgetQueryPayload(query.data);
  const exName = draft.currentExerciseName || 'Упражнение';
  const msgId = query.message?.message_id || draft.widgetMessageId;
  const chatId = query.message?.chat?.id || draft.chatId || userId;

  switch (payload.action) {
    case 'finish_set': {
      const weight = Math.max(0, Math.round(((payload.weight ?? 0) * 10)) / 10);
      const reps = Math.max(1, Math.round(payload.reps ?? 1));

      let exercise = draft.exercises.find((e) => e.name === exName);
      if (!exercise) {
        exercise = { name: exName, sets: [], orderIndex: draft.exercises.length };
        draft.exercises.push(exercise);
      }

      exercise.sets.push({ weight, reps });

      const setIndex = exercise.sets.length;
      const targetSets = 4;
      const nextMode = setIndex >= targetSets ? 'done' : 'resting';
      const restDuration = 90;

      const nextState: LiveWorkoutWidgetState = {
        wid: draft.templateId || `w_${userId}`,
        ex: exName,
        sn: setIndex + 1,
        st: targetSets,
        w: weight,
        r: reps,
        pw: weight,
        pr: reps,
        m: nextMode,
        rd: restDuration,
        rta: nextMode === 'resting' ? Date.now() + restDuration * 1000 : undefined,
        completedSets: exercise.sets.map((s) => ({ w: s.weight, r: s.reps })),
      };

      if (msgId && chatId) {
        await editMessageWidgetData(ctx.telegram, {
          chat_id: chatId,
          message_id: msgId,
          chat_data: serializeWidgetData(nextState),
        }).catch(() => {});
      }

      await answerWidgetQuery(ctx.telegram, {
        widget_query_id: query.id,
        text: `Подход ${setIndex} (${weight} кг × ${reps}) записан!`,
      }).catch(() => {});
      break;
    }

    case 'add_rest': {
      const added = payload.restAdded || 30;
      await answerWidgetQuery(ctx.telegram, {
        widget_query_id: query.id,
        text: `+${added} сек к отдыху`,
      }).catch(() => {});
      break;
    }

    case 'skip_rest': {
      const exercise = draft.exercises.find((e) => e.name === exName);
      const currentSets = exercise?.sets ?? [];
      const setIndex = currentSets.length + 1;
      const lastSet = currentSets[currentSets.length - 1];

      const nextState: LiveWorkoutWidgetState = {
        wid: draft.templateId || `w_${userId}`,
        ex: exName,
        sn: setIndex,
        st: Math.max(4, setIndex),
        w: lastSet?.weight ?? 50,
        r: lastSet?.reps ?? 10,
        pw: lastSet?.weight,
        pr: lastSet?.reps,
        m: 'active',
        rd: 90,
        completedSets: currentSets.map((s) => ({ w: s.weight, r: s.reps })),
      };

      if (msgId && chatId) {
        await editMessageWidgetData(ctx.telegram, {
          chat_id: chatId,
          message_id: msgId,
          chat_data: serializeWidgetData(nextState),
        }).catch(() => {});
      }

      await answerWidgetQuery(ctx.telegram, {
        widget_query_id: query.id,
        text: 'Пора делать подход!',
      }).catch(() => {});
      break;
    }

    case 'finish_exercise': {
      const exercise = draft.exercises.find((e) => e.name === exName);
      const currentSets = exercise?.sets ?? [];
      const nextState: LiveWorkoutWidgetState = {
        wid: draft.templateId || `w_${userId}`,
        ex: exName,
        sn: currentSets.length,
        st: currentSets.length,
        w: currentSets[currentSets.length - 1]?.weight ?? 50,
        r: currentSets[currentSets.length - 1]?.reps ?? 10,
        m: 'done',
        rd: 90,
        completedSets: currentSets.map((s) => ({ w: s.weight, r: s.reps })),
      };

      if (msgId && chatId) {
        await editMessageWidgetData(ctx.telegram, {
          chat_id: chatId,
          message_id: msgId,
          chat_data: serializeWidgetData(nextState),
        }).catch(() => {});
      }

      await answerWidgetQuery(ctx.telegram, {
        widget_query_id: query.id,
        text: 'Упражнение завершено',
      }).catch(() => {});
      break;
    }

    case 'add_set': {
      const exercise = draft.exercises.find((e) => e.name === exName);
      const currentSets = exercise?.sets ?? [];
      const setIndex = currentSets.length + 1;
      const lastSet = currentSets[currentSets.length - 1];

      const nextState: LiveWorkoutWidgetState = {
        wid: draft.templateId || `w_${userId}`,
        ex: exName,
        sn: setIndex,
        st: setIndex,
        w: lastSet?.weight ?? 50,
        r: lastSet?.reps ?? 10,
        pw: lastSet?.weight,
        pr: lastSet?.reps,
        m: 'active',
        rd: 90,
        completedSets: currentSets.map((s) => ({ w: s.weight, r: s.reps })),
      };

      if (msgId && chatId) {
        await editMessageWidgetData(ctx.telegram, {
          chat_id: chatId,
          message_id: msgId,
          chat_data: serializeWidgetData(nextState),
        }).catch(() => {});
      }

      await answerWidgetQuery(ctx.telegram, {
        widget_query_id: query.id,
        text: 'Дополнительный подход!',
      }).catch(() => {});
      break;
    }

    case 'next_exercise': {
      await answerWidgetQuery(ctx.telegram, {
        widget_query_id: query.id,
        text: 'Упражнение завершено',
      }).catch(() => {});

      draft.currentExerciseName = undefined;
      draft.appendToLastExercise = false;
      setStep(userId, 'choosing_exercise_name');

      const recentNames = await getLastExercisesByUser(userId, 6);
      draft.recentExerciseNames = recentNames;

      const promptText = recentNames.length > 0
        ? 'Выбери следующее упражнение из последних или введи новое:'
        : 'Выбери следующее упражнение из справочника или введи своё:';

      await ctx.telegram.sendMessage(chatId, promptText, {
        reply_markup: exerciseNameKeyboard(recentNames, canAddCardio(draft)),
      });
      break;
    }

    case 'finish_workout': {
      await answerWidgetQuery(ctx.telegram, {
        widget_query_id: query.id,
        text: 'Сохраняю тренировку...',
      }).catch(() => {});

      const result = await saveDraftWorkout(userId);
      const markup = result.ok && result.canSaveAsTemplate
        ? Markup.inlineKeyboard([[Markup.button.callback('💾 Сохранить как шаблон', `tpl:new:${result.workoutId}`)]]).reply_markup
        : undefined;

      await ctx.telegram.sendMessage(chatId, result.text, { reply_markup: markup });
      break;
    }

    default: {
      await answerWidgetQuery(ctx.telegram, {
        widget_query_id: query.id,
      }).catch(() => {});
      break;
    }
  }
}
