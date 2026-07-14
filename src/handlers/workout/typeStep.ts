import { Context } from 'telegraf';
import { WorkoutType } from '../../types/domain';
import { getDraft, setType, setStep, canAddCardio } from './state';
import { getLastExercisesByUser } from '../../db/exercises';
import { exerciseNameKeyboard, activityKeyboard } from './keyboards';

export async function handleTypeChosen(ctx: Context, type: WorkoutType): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  setType(userId, type);

  if (type === 'cardio') {
    setStep(userId, 'choosing_cardio_activity');
    await ctx.editMessageText('Выбери активность:', { reply_markup: activityKeyboard() });
    return;
  }

  if (type === 'pool') {
    draft.cardio = { activity: 'pool' };
    setStep(userId, 'entering_cardio_duration');
    await ctx.editMessageText('🕒 Сколько минут длилось плавание? Введи число:');
    return;
  }

  setStep(userId, 'choosing_exercise_name');
  const recentNames = await getLastExercisesByUser(userId, 6);
  draft.recentExerciseNames = recentNames;

  await ctx.editMessageText(
    recentNames.length > 0
      ? 'Выбери упражнение из последних или введи новое:'
      : 'Введи название первого упражнения (кнопка «✏️ Ввести своё название»):',
    { reply_markup: exerciseNameKeyboard(recentNames, canAddCardio(draft)) }
  );
}
