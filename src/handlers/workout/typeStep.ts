import { Context } from 'telegraf';
import { WorkoutType } from '../../types/domain';
import { getDraft, setType, setStep } from './state';
import { getLastExercisesByUser } from '../../db/exercises';
import { exerciseNameKeyboard } from './keyboards';

const STUB_TYPES: WorkoutType[] = ['cardio', 'pool', 'mixed'];

export async function handleTypeChosen(ctx: Context, type: WorkoutType): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  setType(userId, type);

  if (STUB_TYPES.includes(type)) {
    await ctx.editMessageText(
      'Учёт кардио/бассейна/смешанных тренировок появится на следующем этапе. ' +
        'Пока доступна только силовая тренировка — запусти /new_workout и выбери «Силовая».'
    );
    return;
  }

  setStep(userId, 'choosing_exercise_name');
  const recentNames = await getLastExercisesByUser(userId, 6);
  draft.recentExerciseNames = recentNames;

  await ctx.editMessageText(
    recentNames.length > 0
      ? 'Выбери упражнение из последних или введи новое:'
      : 'Введи название первого упражнения (кнопка «✏️ Ввести своё название»):',
    { reply_markup: exerciseNameKeyboard(recentNames) }
  );
}
