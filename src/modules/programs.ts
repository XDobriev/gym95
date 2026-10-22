// Каталог готовых тренировочных программ и сплитов

export interface ProgramDay {
  dayNumber: number;
  title: string;
  type: 'strength' | 'cardio' | 'mixed';
  exercises: string[];
  description: string;
}

export interface WorkoutProgram {
  id: string;
  title: string;
  emoji: string;
  goal: 'lose' | 'gain' | 'regular';
  level: 'beginner' | 'intermediate';
  daysPerWeek: number;
  description: string;
  days: ProgramDay[];
}

export const WORKOUT_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'lose_stadium',
    title: 'Похудение и рельеф (Силовые + Стадион)',
    emoji: '🔥',
    goal: 'lose',
    level: 'intermediate',
    daysPerWeek: 4,
    description:
      'Идеальный баланс сохранения мышечной массы и максимального расхода калорий за счет кругов на стадионе.',
    days: [
      {
        dayNumber: 1,
        title: 'День 1: Верх тела (Грудь + Спина)',
        type: 'strength',
        exercises: ['Жим лежа', 'Тяга верхнего блока', 'Отжимания на брусьях', 'Планка'],
        description: 'Базовая силовая нагрузка на грудь и широчайшие мышцы спины.',
      },
      {
        dayNumber: 2,
        title: 'День 2: Кардио на стадионе',
        type: 'cardio',
        exercises: ['Ходьба / Стадион (10 кругов — 4.0 км)'],
        description: 'Равномерный темп в зоне жиросжигания (120-140 уд/мин).',
      },
      {
        dayNumber: 3,
        title: 'День 3: Низ тела + Плечи + Пресс',
        type: 'strength',
        exercises: ['Приседания со штангой', 'Жим гантелей сидя', 'Выпады', 'Скручивания на пресс'],
        description: 'Энергоемкая тренировка ног и дельтовидных мышц.',
      },
      {
        dayNumber: 4,
        title: 'День 4: Кардио-выносливость',
        type: 'cardio',
        exercises: ['Ходьба / Стадион (12 кругов — 4.8 км)'],
        description: 'Увеличенная дистанция для разгона метаболизма.',
      },
    ],
  },
  {
    id: 'upper_lower',
    title: 'Верх / Низ (4 дня в неделю)',
    emoji: '🏋️‍♂️',
    goal: 'gain',
    level: 'intermediate',
    daysPerWeek: 4,
    description: 'Классический научно доказанный сплит с проработкой каждой мышечной группы 2 раза в неделю.',
    days: [
      {
        dayNumber: 1,
        title: 'Верх А: Сила',
        type: 'strength',
        exercises: ['Жим лежа', 'Тяга штанги в наклоне', 'Армейский жим стоя', 'Подтягивания'],
        description: 'Акцент на тяжелые базовые движения на 6-8 повторений.',
      },
      {
        dayNumber: 2,
        title: 'Низ А: Сила',
        type: 'strength',
        exercises: ['Приседания со штангой', 'Румынская тяга', 'Жим ногами', 'Икры стоя'],
        description: 'Квадрицепсы и задняя поверхность бедра.',
      },
      {
        dayNumber: 3,
        title: 'Верх Б: Гипертрофия',
        type: 'strength',
        exercises: ['Жим гантелей на наклонной', 'Тяга горизонтального блока', 'Махи в стороны', 'Бицепс + Трицепс'],
        description: 'Работа на 10-12 повторений для максимального пампа.',
      },
      {
        dayNumber: 4,
        title: 'Низ Б: Гипертрофия',
        type: 'strength',
        exercises: ['Становая тяга', 'Гакк-приседания', 'Сгибания ног в тренажере', 'Пресс'],
        description: 'Задняя цепь и вспомогательные упражнения.',
      },
    ],
  },
  {
    id: 'street_workout',
    title: 'Домашний воркаут и турники',
    emoji: '🤸‍♂️',
    goal: 'regular',
    level: 'beginner',
    daysPerWeek: 3,
    description: 'Тренировки с собственным весом тела без абонемента в зал: турник, брусья, отжимания и стадион.',
    days: [
      {
        dayNumber: 1,
        title: 'Турники и отжимания',
        type: 'strength',
        exercises: ['Подтягивания широким хватом', 'Отжимания от пола', 'Подтягивания узким хватом', 'Планка'],
        description: 'Работа на максимум повторений в каждом подходе.',
      },
      {
        dayNumber: 2,
        title: 'Брусья и пресс',
        type: 'strength',
        exercises: ['Отжимания на брусьях', 'Австралийские подтягивания', 'Подъем ног к перекладине'],
        description: 'Грудные мышцы, трицепсы и глубокий кор.',
      },
      {
        dayNumber: 3,
        title: 'Стадион и выносливость',
        type: 'cardio',
        exercises: ['Ходьба / Стадион (10 кругов — 4.0 км)', 'Приседания без веса (3x30)'],
        description: 'Ноги и сердечно-сосудистая система.',
      },
    ],
  },
];

/**
 * Форматирует описание программы и ее дней для Telegram.
 */
export function formatProgramDetails(program: WorkoutProgram): string {
  const lines: string[] = [
    `${program.emoji} *Программа: ${program.title}*`,
    `Частота: *${program.daysPerWeek} дня в неделю*`,
    `Уровень: *${program.level === 'beginner' ? 'Для начинающих' : 'Средний / Продвинутый'}*`,
    `_${program.description}_`,
    '',
    '*📅 Расписание дней:*',
  ];

  for (const day of program.days) {
    lines.push(`*${day.title}:*`);
    for (const ex of day.exercises) {
      lines.push(`  ▫️ ${ex}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
