import { Context } from 'telegraf';
import { DraftWorkout } from '../../types/draft';
import { getDraft, setStep, clearDraft, canAddCardio } from './state';
import { getLastExercisesByUser } from '../../db/exercises';
import { formatCardioInline } from '../../utils/format';
import {
  activityKeyboard,
  cardioOptionalKeyboard,
  cardioDoneKeyboard,
  cardioDoneMixedKeyboard,
  exerciseNameKeyboard,
  exerciseSavedMenuKeyboard,
} from './keyboards';

export async function promptCardioActivity(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  setStep(userId, 'choosing_cardio_activity');
  await ctx.editMessageText('Выбери активность:', { reply_markup: activityKeyboard() });
}

export async function handleCardioActivityChosen(
  ctx: Context,
  activity: 'treadmill' | 'bike'
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  draft.cardio = { activity };
  setStep(userId, 'entering_cardio_duration');

  await ctx.editMessageText('🕒 Сколько минут длилась активность? Введи число:');
}

export async function handleCardioDurationEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.cardio) return;

  const minutes = parseInt(text.trim(), 10);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    await ctx.reply('Введи целое число минут больше нуля, например 30');
    return;
  }

  draft.cardio.durationMinutes = minutes;
  setStep(userId, 'entering_cardio_distance');

  await ctx.reply('📏 Дистанция в километрах? Введи число или пропусти:', {
    reply_markup: cardioOptionalKeyboard('w:cardio_skip_distance'),
  });
}

export async function handleCardioDistanceEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.cardio) return;

  const distance = parseFloat(text.trim().replace(',', '.'));
  if (!Number.isFinite(distance) || distance <= 0) {
    await ctx.reply(
      'Введи число километров больше нуля, например 5 или 5.5, либо нажми «⏭️ Пропустить»',
      { reply_markup: cardioOptionalKeyboard('w:cardio_skip_distance') }
    );
    return;
  }

  draft.cardio.distanceKm = distance;
  await askForPulse(ctx, userId, false);
}

export async function handleCardioDistanceSkip(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.cardio) return;

  await askForPulse(ctx, userId, true);
}

async function askForPulse(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  setStep(userId, 'entering_cardio_pulse');
  const text = '❤️ Средний пульс? Введи число или пропусти:';
  const reply_markup = cardioOptionalKeyboard('w:cardio_skip_pulse');

  if (viaEdit) {
    await ctx.editMessageText(text, { reply_markup });
  } else {
    await ctx.reply(text, { reply_markup });
  }
}

export async function handleCardioPulseEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.cardio) return;

  const pulse = parseInt(text.trim(), 10);
  if (!Number.isFinite(pulse) || pulse <= 0) {
    await ctx.reply(
      'Введи число ударов в минуту больше нуля, например 140, либо нажми «⏭️ Пропустить»',
      { reply_markup: cardioOptionalKeyboard('w:cardio_skip_pulse') }
    );
    return;
  }

  draft.cardio.avgHeartRate = pulse;
  await finalizeCardioBlock(ctx, userId, false);
}

export async function handleCardioPulseSkip(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await finalizeCardioBlock(ctx, userId, true);
}

function renderCardioSummary(draft: DraftWorkout): string {
  const cardio = draft.cardio!;
  const details = formatCardioInline({
    activity: cardio.activity!,
    durationMinutes: cardio.durationMinutes ?? null,
    distanceKm: cardio.distanceKm ?? null,
    avgHeartRate: cardio.avgHeartRate ?? null,
  });

  return `✅ <b>Кардио добавлено</b>\n\n${details}`;
}

async function finalizeCardioBlock(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const draft = getDraft(userId);
  if (!draft || !draft.cardio) return;

  setStep(userId, 'cardio_saved_menu');
  const text = renderCardioSummary(draft);
  const reply_markup = draft.type === 'mixed' ? cardioDoneMixedKeyboard() : cardioDoneKeyboard();

  if (viaEdit) {
    await ctx.editMessageText(text, { reply_markup, parse_mode: 'HTML' });
  } else {
    await ctx.reply(text, { reply_markup, parse_mode: 'HTML' });
  }
}

export async function handleCardioCancel(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  draft.cardio = undefined;

  if (draft.type === 'mixed') {
    if (draft.exercises.length > 0) {
      setStep(userId, 'exercise_saved_menu');
      await ctx.editMessageText('Ок, отменил добавление кардио.', {
        reply_markup: exerciseSavedMenuKeyboard(canAddCardio(draft)),
      });
    } else {
      setStep(userId, 'choosing_exercise_name');
      const recentNames = await getLastExercisesByUser(userId, 6);
      draft.recentExerciseNames = recentNames;
      await ctx.editMessageText('Ок, отменил добавление кардио. Выбери упражнение:', {
        reply_markup: exerciseNameKeyboard(recentNames, canAddCardio(draft)),
      });
    }
    return;
  }

  clearDraft(userId);
  await ctx.editMessageText('Тренировка отменена — в ней ничего не сохранено. Начни заново — /new_workout');
}
