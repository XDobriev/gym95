import { Telegraf, Context } from 'telegraf';
import { WorkoutType } from '../../types/domain';
import { getWorkoutOwned, updateWorkoutFields, deleteWorkout } from '../../db/workouts';
import { getExercisesByWorkoutId, updateExerciseSets, deleteExercise } from '../../db/exercises';
import { getCardioSessionsForWorkouts, updateCardioSession } from '../../db/cardio';
import { computeAvgPace } from '../../utils/cardio';
import { parseSetsLine } from '../../utils/setsParser';
import { formatSetsInline, formatDateShortRu, formatWorkoutTypeWithEmoji } from '../../utils/format';
import { formatWorkoutCardText, workoutCardKeyboard } from '../history';
import {
  deleteConfirmKeyboard,
  editMenuKeyboard,
  editTypeKeyboard,
  editCancelKeyboard,
  editCardioSkipKeyboard,
} from './keyboards';
import { getEditSession, startEditSession, clearEditSession, setEditStep, EditSession } from './editState';

// Правка кардио идёт цепочкой шагов (как при создании тренировки), но «пропустить»
// здесь означает «оставить как в БД», а не «оставить пустым» — поэтому draft
// предзаполняется текущими значениями сессии при входе в цепочку.

function callbackTarget(ctx: Context): { chatId: number; messageId: number } | null {
  const chatId = ctx.chat?.id;
  const messageId =
    ctx.callbackQuery && 'message' in ctx.callbackQuery ? ctx.callbackQuery.message?.message_id : undefined;
  if (!chatId || !messageId) return null;
  return { chatId, messageId };
}

// Единая точка перерисовки — работает и из callback-обработчиков, и из текстовых
// (у текстовых апдейтов нет «текущего сообщения для правки», поэтому везде адресуем
// по chatId/messageId явно через ctx.telegram, а не ctx.editMessageText).
async function renderCardById(
  ctx: Context,
  chatId: number,
  messageId: number,
  workoutId: string,
  userId: number,
  offset: number
): Promise<void> {
  const workout = await getWorkoutOwned(userId, workoutId);
  if (!workout) {
    await ctx.telegram.editMessageText(chatId, messageId, undefined, 'Тренировка не найдена — возможно, уже удалена.').catch(() => undefined);
    return;
  }
  const [exercises, cardioSessions] = await Promise.all([
    getExercisesByWorkoutId(workoutId),
    getCardioSessionsForWorkouts([workoutId]),
  ]);
  const text = formatWorkoutCardText(workout, exercises, cardioSessions[0]);
  await ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
    reply_markup: workoutCardKeyboard(workoutId, offset),
  });
}

async function renderMenuById(
  ctx: Context,
  chatId: number,
  messageId: number,
  workoutId: string,
  userId: number,
  offset: number
): Promise<void> {
  const workout = await getWorkoutOwned(userId, workoutId);
  if (!workout) {
    await ctx.telegram.editMessageText(chatId, messageId, undefined, 'Тренировка не найдена — возможно, уже удалена.').catch(() => undefined);
    return;
  }
  const [exercises, cardioSessions] = await Promise.all([
    getExercisesByWorkoutId(workoutId),
    getCardioSessionsForWorkouts([workoutId]),
  ]);
  await ctx.telegram.editMessageText(chatId, messageId, undefined, 'Что изменить?', {
    reply_markup: editMenuKeyboard(workoutId, offset, exercises.map((ex) => ex.name), cardioSessions.length > 0),
  });
}

function parseDateInput(text: string): { ok: true; iso: string } | { ok: false; error: string } {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text.trim());
  if (!match) {
    return { ok: false, error: 'Не понял дату. Формат: ДД.ММ.ГГГГ, например 05.03.2026' };
  }
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, error: 'Такой даты не существует. Формат: ДД.ММ.ГГГГ, например 05.03.2026' };
  }
  return { ok: true, iso: date.toISOString() };
}

function parseOptionalPositiveInt(text: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === '-') return { ok: true, value: null };
  const value = parseInt(trimmed, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: 'Введи целое число больше нуля, или «-» чтобы очистить' };
  }
  return { ok: true, value };
}

const NOTES_MAX_LENGTH = 1000;

function parseNotesInput(text: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === '-') return { ok: true, value: null };
  if (trimmed.length > NOTES_MAX_LENGTH) {
    return { ok: false, error: `Заметка слишком длинная (максимум ${NOTES_MAX_LENGTH} символов)` };
  }
  return { ok: true, value: trimmed };
}

async function finishEdit(ctx: Context, session: EditSession): Promise<void> {
  clearEditSession(session.userId);
  await renderCardById(ctx, session.chatId, session.messageId, session.workoutId, session.userId, session.offset);
}

// --- Цепочка правки кардио: дистанция → (уклон, если применимо) → пульс → сохранение ---

function cardioSkipKeyboardFor(workoutId: string, offset: number) {
  return editCardioSkipKeyboard(`wecs:${workoutId}:${offset}`, workoutId, offset);
}

async function askCardioDistance(ctx: Context, session: EditSession): Promise<void> {
  setEditStep(session.userId, 'awaiting_cardio_distance');
  const current = session.cardioDraft?.distanceKm;
  const text = `📏 Дистанция в километрах? Сейчас: ${current ?? 'не указана'}. Введи число, «-» или «⏭️», чтобы оставить как есть:`;
  await ctx.telegram.editMessageText(session.chatId, session.messageId, undefined, text, {
    reply_markup: cardioSkipKeyboardFor(session.workoutId, session.offset),
  });
}

async function askCardioIncline(ctx: Context, session: EditSession): Promise<void> {
  setEditStep(session.userId, 'awaiting_cardio_incline');
  const current = session.cardioDraft?.inclinePercent;
  const text = `⛰️ Уклон в %? Сейчас: ${current ?? 'не указан'}. Введи число, «-» или «⏭️», чтобы оставить как есть:`;
  await ctx.telegram.editMessageText(session.chatId, session.messageId, undefined, text, {
    reply_markup: cardioSkipKeyboardFor(session.workoutId, session.offset),
  });
}

async function askCardioPulse(ctx: Context, session: EditSession): Promise<void> {
  setEditStep(session.userId, 'awaiting_cardio_pulse');
  const current = session.cardioDraft?.avgHeartRate;
  const text = `❤️ Средний пульс? Сейчас: ${current ?? 'не указан'}. Введи число, «-» или «⏭️», чтобы оставить как есть:`;
  await ctx.telegram.editMessageText(session.chatId, session.messageId, undefined, text, {
    reply_markup: cardioSkipKeyboardFor(session.workoutId, session.offset),
  });
}

async function finalizeCardioEdit(ctx: Context, session: EditSession): Promise<void> {
  const draft = session.cardioDraft;
  if (!draft || !session.cardioId) {
    await finishEdit(ctx, session);
    return;
  }

  const workout = await getWorkoutOwned(session.userId, session.workoutId);
  const avgPace =
    workout?.duration_minutes != null ? computeAvgPace(workout.duration_minutes, draft.distanceKm ?? null) : null;

  await updateCardioSession(session.userId, session.workoutId, session.cardioId, {
    distanceKm: draft.distanceKm ?? null,
    inclinePercent: draft.inclinePercent ?? null,
    avgHeartRate: draft.avgHeartRate ?? null,
    avgPace,
  });

  await finishEdit(ctx, session);
}

// Продвигает цепочку кардио на следующий шаг (или сохраняет, если пульс был последним).
async function advanceCardioStep(ctx: Context, session: EditSession): Promise<void> {
  if (session.step === 'awaiting_cardio_distance') {
    const activity = session.cardioDraft?.activity;
    const needsIncline = activity === 'running' || activity === 'walking';
    if (needsIncline) {
      await askCardioIncline(ctx, session);
    } else {
      await askCardioPulse(ctx, session);
    }
    return;
  }
  if (session.step === 'awaiting_cardio_incline') {
    await askCardioPulse(ctx, session);
    return;
  }
  await finalizeCardioEdit(ctx, session);
}

export function registerWorkoutEdit(bot: Telegraf): void {
  bot.action(/^we:([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    const target = callbackTarget(ctx);
    if (!userId || !target) return;

    const workoutId = ctx.match[1];
    const offset = parseInt(ctx.match[2], 10);
    startEditSession({ userId, chatId: target.chatId, messageId: target.messageId, workoutId, offset });
    await renderMenuById(ctx, target.chatId, target.messageId, workoutId, userId, offset);
  });

  bot.action(/^wecl:([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    const target = callbackTarget(ctx);
    if (!userId || !target) return;

    clearEditSession(userId);
    const workoutId = ctx.match[1];
    const offset = parseInt(ctx.match[2], 10);
    await renderCardById(ctx, target.chatId, target.messageId, workoutId, userId, offset);
  });

  bot.action(/^wd:([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    const target = callbackTarget(ctx);
    if (!userId || !target) return;

    const workoutId = ctx.match[1];
    const offset = parseInt(ctx.match[2], 10);
    const workout = await getWorkoutOwned(userId, workoutId);
    if (!workout) {
      await ctx.telegram
        .editMessageText(target.chatId, target.messageId, undefined, 'Тренировка не найдена — возможно, уже удалена.')
        .catch(() => undefined);
      return;
    }

    const text = `Удалить тренировку от ${formatDateShortRu(workout.date)} (${formatWorkoutTypeWithEmoji(workout.type)})? Это нельзя отменить.`;
    await ctx.telegram.editMessageText(target.chatId, target.messageId, undefined, text, {
      reply_markup: deleteConfirmKeyboard(workoutId, offset),
    });
  });

  bot.action(/^wdc:([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const workoutId = ctx.match[1];
    await deleteWorkout(userId, workoutId);
    clearEditSession(userId);

    // Двойной тап / уже удалена другим путём — итог одинаков: карточки не должно
    // остаться на экране, поэтому просто убираем сообщение независимо от результата.
    await ctx.deleteMessage().catch(async () => {
      await ctx.editMessageText('🗑 Тренировка удалена.').catch(() => undefined);
    });
  });

  bot.action(/^wdx:([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    const target = callbackTarget(ctx);
    if (!userId || !target) return;

    const workoutId = ctx.match[1];
    const offset = parseInt(ctx.match[2], 10);
    await renderCardById(ctx, target.chatId, target.messageId, workoutId, userId, offset);
  });

  bot.action(/^wef:(date|type|duration|warmup|notes|cardio):([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    const target = callbackTarget(ctx);
    if (!userId || !target) return;

    const field = ctx.match[1];
    const workoutId = ctx.match[2];
    const offset = parseInt(ctx.match[3], 10);
    const session = startEditSession({ userId, chatId: target.chatId, messageId: target.messageId, workoutId, offset });

    switch (field) {
      case 'date':
        setEditStep(userId, 'awaiting_date');
        await ctx.telegram.editMessageText(
          target.chatId,
          target.messageId,
          undefined,
          '📅 Введи новую дату в формате ДД.ММ.ГГГГ, например 05.03.2026:',
          { reply_markup: editCancelKeyboard(workoutId, offset) }
        );
        return;

      case 'type':
        setEditStep(userId, 'awaiting_type');
        await ctx.telegram.editMessageText(target.chatId, target.messageId, undefined, '🏷 Выбери новый тип:', {
          reply_markup: editTypeKeyboard(workoutId, offset),
        });
        return;

      case 'duration':
        setEditStep(userId, 'awaiting_duration');
        await ctx.telegram.editMessageText(
          target.chatId,
          target.messageId,
          undefined,
          '🕒 Сколько минут длилась тренировка? Введи число, или «-» чтобы очистить:',
          { reply_markup: editCancelKeyboard(workoutId, offset) }
        );
        return;

      case 'warmup':
        setEditStep(userId, 'awaiting_warmup');
        await ctx.telegram.editMessageText(
          target.chatId,
          target.messageId,
          undefined,
          '🔥 Сколько минут разминка? Введи число, или «-» чтобы очистить:',
          { reply_markup: editCancelKeyboard(workoutId, offset) }
        );
        return;

      case 'notes':
        setEditStep(userId, 'awaiting_notes');
        await ctx.telegram.editMessageText(
          target.chatId,
          target.messageId,
          undefined,
          '📝 Введи заметку, или «-» чтобы очистить:',
          { reply_markup: editCancelKeyboard(workoutId, offset) }
        );
        return;

      case 'cardio': {
        const cardioSessions = await getCardioSessionsForWorkouts([workoutId]);
        const cardio = cardioSessions[0];
        if (!cardio) {
          await renderMenuById(ctx, target.chatId, target.messageId, workoutId, userId, offset);
          return;
        }
        session.cardioId = cardio.id;
        session.cardioDraft = {
          activity: cardio.activity,
          distanceKm: cardio.distance_km ?? undefined,
          inclinePercent: cardio.incline_percent ?? undefined,
          avgHeartRate: cardio.avg_heart_rate ?? undefined,
        };
        await askCardioDistance(ctx, session);
        return;
      }
    }
  });

  bot.action(/^wex:(\d+):([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    const target = callbackTarget(ctx);
    if (!userId || !target) return;

    const index = parseInt(ctx.match[1], 10);
    const workoutId = ctx.match[2];
    const offset = parseInt(ctx.match[3], 10);

    const exercises = await getExercisesByWorkoutId(workoutId);
    const exercise = exercises[index];
    if (!exercise) {
      await renderMenuById(ctx, target.chatId, target.messageId, workoutId, userId, offset);
      return;
    }

    startEditSession({ userId, chatId: target.chatId, messageId: target.messageId, workoutId, offset });
    setEditStep(userId, 'awaiting_exercise_sets');
    const session = getEditSession(userId);
    if (session) session.exerciseOrderIndex = index;

    await ctx.telegram.editMessageText(
      target.chatId,
      target.messageId,
      undefined,
      `${exercise.name}. Сейчас: ${formatSetsInline(exercise.sets)}\nВведи новые подходы, например: 40x12, 40x12`,
      { reply_markup: editCancelKeyboard(workoutId, offset) }
    );
  });

  bot.action(/^wexd:(\d+):([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    const target = callbackTarget(ctx);
    if (!userId || !target) return;

    const index = parseInt(ctx.match[1], 10);
    const workoutId = ctx.match[2];
    const offset = parseInt(ctx.match[3], 10);

    const exercises = await getExercisesByWorkoutId(workoutId);
    const exercise = exercises[index];
    if (exercise) {
      await deleteExercise(userId, workoutId, exercise.id);
    }
    await renderMenuById(ctx, target.chatId, target.messageId, workoutId, userId, offset);
  });

  bot.action(/^wet:(cardio|strength|pool|mixed):([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    const target = callbackTarget(ctx);
    if (!userId || !target) return;

    const type = ctx.match[1] as WorkoutType;
    const workoutId = ctx.match[2];
    const offset = parseInt(ctx.match[3], 10);

    await updateWorkoutFields(userId, workoutId, { type });
    clearEditSession(userId);
    await renderCardById(ctx, target.chatId, target.messageId, workoutId, userId, offset);
  });

  bot.action(/^wecs:([^:]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = getEditSession(userId);
    if (!session) return;
    await advanceCardioStep(ctx, session);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from?.id;
    const session = userId ? getEditSession(userId) : undefined;
    if (!session) {
      return next();
    }

    const text = 'text' in ctx.message ? ctx.message.text : '';

    switch (session.step) {
      case 'awaiting_date': {
        const parsed = parseDateInput(text);
        if (!parsed.ok) {
          await ctx.reply(parsed.error);
          return;
        }
        await updateWorkoutFields(session.userId, session.workoutId, { date: parsed.iso });
        await finishEdit(ctx, session);
        return;
      }

      case 'awaiting_duration': {
        const parsed = parseOptionalPositiveInt(text);
        if (!parsed.ok) {
          await ctx.reply(parsed.error);
          return;
        }
        await updateWorkoutFields(session.userId, session.workoutId, { durationMinutes: parsed.value });
        await finishEdit(ctx, session);
        return;
      }

      case 'awaiting_warmup': {
        const parsed = parseOptionalPositiveInt(text);
        if (!parsed.ok) {
          await ctx.reply(parsed.error);
          return;
        }
        await updateWorkoutFields(session.userId, session.workoutId, { warmupMinutes: parsed.value });
        await finishEdit(ctx, session);
        return;
      }

      case 'awaiting_notes': {
        const parsed = parseNotesInput(text);
        if (!parsed.ok) {
          await ctx.reply(parsed.error);
          return;
        }
        await updateWorkoutFields(session.userId, session.workoutId, { notes: parsed.value });
        await finishEdit(ctx, session);
        return;
      }

      case 'awaiting_exercise_sets': {
        const result = parseSetsLine(text);
        if (!result.ok) {
          await ctx.reply(result.error);
          return;
        }
        const exercises = await getExercisesByWorkoutId(session.workoutId);
        const exercise = exercises[session.exerciseOrderIndex ?? -1];
        if (!exercise) {
          await ctx.reply('Это упражнение уже удалено.');
          clearEditSession(session.userId);
          await renderMenuById(ctx, session.chatId, session.messageId, session.workoutId, session.userId, session.offset);
          return;
        }
        await updateExerciseSets(session.userId, session.workoutId, exercise.id, result.sets);
        await finishEdit(ctx, session);
        return;
      }

      case 'awaiting_cardio_distance': {
        const trimmed = text.trim().replace(',', '.');
        if (trimmed !== '-') {
          const value = parseFloat(trimmed);
          if (!Number.isFinite(value) || value <= 0) {
            await ctx.reply('Введи число больше нуля, «-» или нажми «⏭️ Оставить как есть»');
            return;
          }
          if (session.cardioDraft) session.cardioDraft.distanceKm = value;
        }
        await advanceCardioStep(ctx, session);
        return;
      }

      case 'awaiting_cardio_incline': {
        const trimmed = text.trim().replace(',', '.');
        if (trimmed !== '-') {
          const value = parseFloat(trimmed);
          if (!Number.isFinite(value) || value < 0) {
            await ctx.reply('Введи неотрицательное число, «-» или нажми «⏭️ Оставить как есть»');
            return;
          }
          if (session.cardioDraft) session.cardioDraft.inclinePercent = value;
        }
        await advanceCardioStep(ctx, session);
        return;
      }

      case 'awaiting_cardio_pulse': {
        const trimmed = text.trim();
        if (trimmed !== '-') {
          const value = parseInt(trimmed, 10);
          if (!Number.isFinite(value) || value <= 0) {
            await ctx.reply('Введи целое число больше нуля, «-» или нажми «⏭️ Оставить как есть»');
            return;
          }
          if (session.cardioDraft) session.cardioDraft.avgHeartRate = value;
        }
        await advanceCardioStep(ctx, session);
        return;
      }

      default:
        return next();
    }
  });
}
