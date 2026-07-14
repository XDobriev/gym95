import { Context } from 'telegraf';
import { WorkoutType } from '../../types/domain';
import { getDraft, setType, setStep } from './state';
import { activityKeyboard, optionalSkipKeyboard } from './keyboards';
import { renderExerciseMenu } from './exerciseNameStep';

export async function handleTypeChosen(ctx: Context, type: WorkoutType): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  setType(userId, type);
  setStep(userId, 'entering_warmup');
  await ctx.editMessageText('🔥 Была разминка/растяжка? Сколько минут? Введи число или пропусти:', {
    reply_markup: optionalSkipKeyboard('w:warmup_skip'),
  });
}

async function proceedAfterWarmup(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const draft = getDraft(userId);
  if (!draft || !draft.type) return;

  if (draft.type === 'cardio') {
    setStep(userId, 'choosing_cardio_activity');
    const text = 'Выбери активность:';
    const reply_markup = activityKeyboard();
    if (viaEdit) {
      await ctx.editMessageText(text, { reply_markup });
    } else {
      await ctx.reply(text, { reply_markup });
    }
    return;
  }

  if (draft.type === 'pool') {
    draft.cardio = { activity: 'pool' };
    setStep(userId, 'entering_cardio_duration');
    const text = '🕒 Сколько минут длилось плавание? Введи число:';
    if (viaEdit) {
      await ctx.editMessageText(text);
    } else {
      await ctx.reply(text);
    }
    return;
  }

  await renderExerciseMenu(ctx, userId, viaEdit);
}

export async function handleWarmupMinutesEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  const minutes = parseInt(text.trim(), 10);
  if (!Number.isFinite(minutes) || minutes < 0) {
    await ctx.reply('Введи целое число минут (0 и больше), например 10, либо нажми «⏭️ Пропустить»');
    return;
  }

  draft.warmupMinutes = minutes;
  await proceedAfterWarmup(ctx, userId, false);
}

export async function handleWarmupSkip(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await proceedAfterWarmup(ctx, userId, true);
}
