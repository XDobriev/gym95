import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { MuscleGroup } from '../../types/domain';

const MUSCLE_GROUPS: { key: MuscleGroup; label: string; emoji: string }[] = [
  { key: 'chest', label: 'Грудь', emoji: '🫸' },
  { key: 'back', label: 'Спина', emoji: '🫷' },
  { key: 'legs', label: 'Ноги', emoji: '🦵' },
  { key: 'shoulders', label: 'Плечи', emoji: '🙌' },
  { key: 'arms', label: 'Руки', emoji: '💪' },
  { key: 'abs', label: 'Пресс', emoji: '🎯' },
];

const BUTTON_LABEL_MAX_LENGTH = 24;

// Обрезает длинные пользовательские названия для подписи кнопки — сама подпись
// не участвует в поиске упражнения, callback data всегда хранит индекс.
function truncateForButton(name: string): string {
  return name.length > BUTTON_LABEL_MAX_LENGTH
    ? `${name.slice(0, BUTTON_LABEL_MAX_LENGTH - 1)}…`
    : name;
}

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
    [Markup.button.callback('❌ Отменить', 'w:cancel_workout')],
  ]).reply_markup;
}

export function exerciseNameKeyboard(recentNames: string[], showAddCardio = false): InlineKeyboardMarkup {
  const nameButtons = recentNames
    .slice(0, 6)
    .map((name, index) => Markup.button.callback(truncateForButton(name), `w:ex:${index}`));

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
  const groupButtons = MUSCLE_GROUPS.map((g) =>
    Markup.button.callback(`${g.emoji} ${g.label}`, `w:muscle_group:${g.key}`)
  );

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < groupButtons.length; i += 2) {
    rows.push(groupButtons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback('🌟 Мои упражнения', 'w:muscle_group:mine')]);
  rows.push([Markup.button.callback('⬅️ Назад', 'w:back_to_exercise_menu')]);

  return Markup.inlineKeyboard(rows).reply_markup;
}

export function groupExerciseKeyboard(names: string[]): InlineKeyboardMarkup {
  const nameButtons = names.map((name, index) =>
    Markup.button.callback(truncateForButton(name), `w:group_ex:${index}`)
  );

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

export function optionalSkipKeyboard(
  skipAction: string,
  cancelAction?: string,
  cancelLabel = '❌ Отмена'
): InlineKeyboardMarkup {
  const rows = [[Markup.button.callback('⏭️ Пропустить', skipAction)]];
  if (cancelAction) {
    rows.push([Markup.button.callback(cancelLabel, cancelAction)]);
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

export function deleteConfirmKeyboard(workoutId: string, offset: number): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Да, удалить', `wdc:${workoutId}:${offset}`),
      Markup.button.callback('❌ Отмена', `wdx:${workoutId}:${offset}`),
    ],
  ]).reply_markup;
}

// Меню точечной правки: по кнопке на скалярное поле + пара кнопок (правка/удаление)
// на каждое упражнение + кардио, если есть. Добавление упражнений и смена их порядка
// в боте не поддерживаются (это делается в Mini App) — здесь только то, что укладывается
// в один текстовый ответ.
export function editMenuKeyboard(
  workoutId: string,
  offset: number,
  exerciseNames: string[],
  hasCardio: boolean
): InlineKeyboardMarkup {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [
      Markup.button.callback('📅 Дата', `wef:date:${workoutId}:${offset}`),
      Markup.button.callback('🏷 Тип', `wef:type:${workoutId}:${offset}`),
    ],
    [
      Markup.button.callback('🕒 Длительность', `wef:duration:${workoutId}:${offset}`),
      Markup.button.callback('🔥 Разминка', `wef:warmup:${workoutId}:${offset}`),
    ],
    [Markup.button.callback('📝 Заметки', `wef:notes:${workoutId}:${offset}`)],
  ];

  exerciseNames.forEach((name, index) => {
    rows.push([
      Markup.button.callback(`✏️ ${truncateForButton(name)}`, `wex:${index}:${workoutId}:${offset}`),
      Markup.button.callback('🗑', `wexd:${index}:${workoutId}:${offset}`),
    ]);
  });

  if (hasCardio) {
    rows.push([Markup.button.callback('🏃 Кардио', `wef:cardio:${workoutId}:${offset}`)]);
  }

  rows.push([Markup.button.callback('⬅️ Закрыть', `wecl:${workoutId}:${offset}`)]);

  return Markup.inlineKeyboard(rows).reply_markup;
}

export function editTypeKeyboard(workoutId: string, offset: number): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🏋️ Силовая', `wet:strength:${workoutId}:${offset}`),
      Markup.button.callback('🏃 Кардио', `wet:cardio:${workoutId}:${offset}`),
    ],
    [
      Markup.button.callback('🏊 Бассейн', `wet:pool:${workoutId}:${offset}`),
      Markup.button.callback('🔀 Смешанная', `wet:mixed:${workoutId}:${offset}`),
    ],
    [Markup.button.callback('❌ Отмена', `we:${workoutId}:${offset}`)],
  ]).reply_markup;
}

// Кнопка отмены под текстовым промптом правки — возвращает в меню правки (не в карточку),
// чтобы можно было сразу попробовать другое поле.
export function editCancelKeyboard(workoutId: string, offset: number): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', `we:${workoutId}:${offset}`)]]).reply_markup;
}

export function editCardioSkipKeyboard(
  skipAction: string,
  workoutId: string,
  offset: number
): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⏭️ Оставить как есть', skipAction)],
    [Markup.button.callback('❌ Отмена', `we:${workoutId}:${offset}`)],
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
