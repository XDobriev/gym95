import { Context } from 'telegraf';
import { DraftWorkout } from '../../types/draft';
import { getDraft, setStep, clearDraft, canAddCardio } from './state';
import { formatCardioInline } from '../../utils/format';
import { renderExerciseMenu } from './exerciseNameStep';
import {
  activityKeyboard,
  cardioDurationQuickKeyboard,
  optionalSkipKeyboard,
  cardioDoneKeyboard,
  cardioDoneMixedKeyboard,
  exerciseSavedMenuKeyboard,
} from './keyboards';

type CardioActivityChoice = 'treadmill' | 'bike' | 'running' | 'walking';

const QUICK_DURATION_ACTIVITIES: CardioActivityChoice[] = ['running', 'walking'];
const INCLINE_ACTIVITIES: CardioActivityChoice[] = ['running', 'walking'];

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
  activity: CardioActivityChoice
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  draft.cardio = { activity };
  setStep(userId, 'entering_cardio_duration');

  if (QUICK_DURATION_ACTIVITIES.includes(activity)) {
    await ctx.editMessageText('🕒 Длительность обычно 30 мин — оставь или введи своё число:', {
      reply_markup: cardioDurationQuickKeyboard(),
    });
  } else {
    await ctx.editMessageText('🕒 Сколько минут длилась активность? Введи число:');
  }
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
  await proceedAfterDuration(ctx, userId, false);
}

export async function handleCardioDurationDefault(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.cardio) return;

  draft.cardio.durationMinutes = 30;
  await proceedAfterDuration(ctx, userId, true);
}

async function proceedAfterDuration(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  setStep(userId, 'entering_cardio_distance');
  const text = '📏 Дистанция в километрах? Введи число или пропусти:';
  const reply_markup = optionalSkipKeyboard('w:cardio_skip_distance', 'w:cardio_cancel');

  if (viaEdit) {
    await ctx.editMessageText(text, { reply_markup });
  } else {
    await ctx.reply(text, { reply_markup });
  }
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
      { reply_markup: optionalSkipKeyboard('w:cardio_skip_distance', 'w:cardio_cancel') }
    );
    return;
  }

  draft.cardio.distanceKm = distance;
  await proceedAfterDistance(ctx, userId, false);
}

export async function handleCardioDistanceSkip(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.cardio) return;

  await proceedAfterDistance(ctx, userId, true);
}

async function proceedAfterDistance(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const draft = getDraft(userId);
  if (!draft || !draft.cardio?.activity) return;

  if (INCLINE_ACTIVITIES.includes(draft.cardio.activity as CardioActivityChoice)) {
    await askForIncline(ctx, userId, viaEdit);
  } else {
    await askForPulse(ctx, userId, viaEdit);
  }
}

async function askForIncline(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  setStep(userId, 'entering_cardio_incline');
  const text = '⛰️ Уклон в %? Введи число или пропусти:';
  const reply_markup = optionalSkipKeyboard('w:cardio_skip_incline', 'w:cardio_cancel');

  if (viaEdit) {
    await ctx.editMessageText(text, { reply_markup });
  } else {
    await ctx.reply(text, { reply_markup });
  }
}

export async function handleCardioInclineEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.cardio) return;

  const incline = parseFloat(text.trim().replace(',', '.'));
  if (!Number.isFinite(incline) || incline < 0) {
    await ctx.reply(
      'Введи число процентов уклона, например 2 или 5.5, либо нажми «⏭️ Пропустить»',
      { reply_markup: optionalSkipKeyboard('w:cardio_skip_incline', 'w:cardio_cancel') }
    );
    return;
  }

  draft.cardio.inclinePercent = incline;
  await askForPulse(ctx, userId, false);
}

export async function handleCardioInclineSkip(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.cardio) return;

  await askForPulse(ctx, userId, true);
}

async function askForPulse(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  setStep(userId, 'entering_cardio_pulse');
  const text = '❤️ Средний пульс? Введи число или пропусти:';
  const reply_markup = optionalSkipKeyboard('w:cardio_skip_pulse', 'w:cardio_cancel');

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
      { reply_markup: optionalSkipKeyboard('w:cardio_skip_pulse', 'w:cardio_cancel') }
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
    inclinePercent: cardio.inclinePercent ?? null,
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
      await renderExerciseMenu(ctx, userId, true, 'Ок, отменил добавление кардио. ');
    }
    return;
  }

  clearDraft(userId);
  await ctx.editMessageText('Тренировка отменена — в ней ничего не сохранено. Начни заново — /new_workout');
}
