import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { MuscleGroup } from '../../types/domain';

const MUSCLE_GROUPS: { key: MuscleGroup; label: string }[] = [
  { key: 'chest', label: 'Грудь' },
  { key: 'back', label: 'Спина' },
  { key: 'legs', label: 'Ноги' },
  { key: 'shoulders', label: 'Плечи' },
  { key: 'arms', label: 'Руки' },
  { key: 'abs', label: 'Пресс' },
];

export function typeKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🏋️ Силовая', 'w:type:strength'),
      Markup.button.callback('🏃 Кардио', 'w:type:cardio'),
    ],
    [
      Markup.button.callback('🏊 Бассейн', 'w:type:pool'),
      Markup.button.callback('🔀 Смешанная', 'w:type:mixed'),
    ],
  ]).reply_markup;
}

export function exerciseNameKeyboard(recentNames: string[], showAddCardio = false): InlineKeyboardMarkup {
  const nameButtons = recentNames
    .slice(0, 6)
    .map((name, index) => Markup.button.callback(name, `w:ex:${index}`));

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < nameButtons.length; i += 2) {
    rows.push(nameButtons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback('📋 Все упражнения', 'w:all_exercises')]);
  rows.push([Markup.button.callback('✏️ Ввести своё название', 'w:ex:custom')]);
  if (showAddCardio) {
    rows.push([Markup.button.callback('🏃 Добавить кардио', 'w:add_cardio')]);
  }
  rows.push([Markup.button.callback('✅ Завершить тренировку', 'w:finish')]);

  return Markup.inlineKeyboard(rows).reply_markup;
}

export function muscleGroupKeyboard(): InlineKeyboardMarkup {
  const groupButtons = MUSCLE_GROUPS.map((g) => Markup.button.callback(g.label, `w:muscle_group:${g.key}`));

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < groupButtons.length; i += 2) {
    rows.push(groupButtons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback('🌟 Мои упражнения', 'w:muscle_group:mine')]);
  rows.push([Markup.button.callback('⬅️ Назад', 'w:back_to_exercise_menu')]);

  return Markup.inlineKeyboard(rows).reply_markup;
}

export function groupExerciseKeyboard(names: string[]): InlineKeyboardMarkup {
  const nameButtons = names.map((name, index) => Markup.button.callback(name, `w:group_ex:${index}`));

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < nameButtons.length; i += 2) {
    rows.push(nameButtons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback('⬅️ Назад к группам', 'w:muscle_group_back')]);

  return Markup.inlineKeyboard(rows).reply_markup;
}

export function enteringSetsKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Отмена упражнения', 'w:cancel_exercise')],
  ]).reply_markup;
}

export function exerciseSavedMenuKeyboard(showAddCardio = false): InlineKeyboardMarkup {
  const rows = [
    [Markup.button.callback('➕ Ещё подход', 'w:add_more_sets')],
    [Markup.button.callback('🔁 Повторить последний подход', 'w:repeat_last')],
    [Markup.button.callback('➡️ Следующее упражнение', 'w:next_exercise')],
  ];
  if (showAddCardio) {
    rows.push([Markup.button.callback('🏃 Добавить кардио', 'w:add_cardio')]);
  }
  rows.push([Markup.button.callback('✅ Завершить тренировку', 'w:finish')]);

  return Markup.inlineKeyboard(rows).reply_markup;
}

export function activityKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎽 Беговая дорожка', 'w:cardio_activity:treadmill'),
      Markup.button.callback('🚴 Велосипед', 'w:cardio_activity:bike'),
    ],
    [
      Markup.button.callback('🏃 Бег', 'w:cardio_activity:running'),
      Markup.button.callback('🚶 Ходьба', 'w:cardio_activity:walking'),
    ],
  ]).reply_markup;
}

export function cardioDurationQuickKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ 30 мин', 'w:cardio_duration_default')],
  ]).reply_markup;
}

export function optionalSkipKeyboard(skipAction: string, cancelAction?: string): InlineKeyboardMarkup {
  const rows = [[Markup.button.callback('⏭️ Пропустить', skipAction)]];
  if (cancelAction) {
    rows.push([Markup.button.callback('❌ Отмена кардио', cancelAction)]);
  }
  return Markup.inlineKeyboard(rows).reply_markup;
}

export function cardioDoneKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Завершить тренировку', 'w:finish')],
  ]).reply_markup;
}

export function cardioDoneMixedKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Ещё упражнение', 'w:next_exercise')],
    [Markup.button.callback('✅ Завершить тренировку', 'w:finish')],
  ]).reply_markup;
}

export function resumeOrRestartKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('▶️ Продолжить', 'w:resume'),
      Markup.button.callback('🔄 Начать заново', 'w:restart'),
    ],
  ]).reply_markup;
}
