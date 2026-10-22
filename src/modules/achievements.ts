// Система достижений (ачивок) и наград за регулярность, силу, кардио и питание

export interface Badge {
  id: string;
  category: 'cardio' | 'strength' | 'water' | 'streak' | 'weight';
  emoji: string;
  title: string;
  description: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface UserStatsForBadges {
  totalWorkouts: number;
  totalStadiumLaps: number;
  totalCardioKm: number;
  maxWeightLifted: number;
  maxSingleWorkoutTonnage: number;
  currentStreakDays: number;
  bestStreakDays: number;
  consecutiveWaterDays: number;
  weightLossKg: number;
}

/**
 * Рассчитывает статус всех доступных достижений.
 */
export function evaluateBadges(stats: UserStatsForBadges): Badge[] {
  const badges: Badge[] = [
    // --- КАРДИО И СТАДИОН ---
    {
      id: 'stadium_10',
      category: 'cardio',
      emoji: '🥉',
      title: 'Первые круги',
      description: 'Преодолеть 10 кругов на стадионе (4.0 км)',
      currentValue: Math.min(10, stats.totalStadiumLaps),
      targetValue: 10,
      unit: 'кр',
      unlocked: stats.totalStadiumLaps >= 10,
    },
    {
      id: 'stadium_50',
      category: 'cardio',
      emoji: '🥈',
      title: 'Стадионный бегун',
      description: 'Преодолеть 50 кругов на стадионе (20 км)',
      currentValue: Math.min(50, stats.totalStadiumLaps),
      targetValue: 50,
      unit: 'кр',
      unlocked: stats.totalStadiumLaps >= 50,
    },
    {
      id: 'stadium_100',
      category: 'cardio',
      emoji: '🥇',
      title: 'Хозяин стадиона',
      description: 'Преодолеть 100 кругов на стадионе (40 км)',
      currentValue: Math.min(100, stats.totalStadiumLaps),
      targetValue: 100,
      unit: 'кр',
      unlocked: stats.totalStadiumLaps >= 100,
    },

    // --- СИЛА И ТРЕНИРОВКИ ---
    {
      id: 'first_workout',
      category: 'strength',
      emoji: '🔰',
      title: 'Первый шаг',
      description: 'Записать свою первую тренировку',
      currentValue: Math.min(1, stats.totalWorkouts),
      targetValue: 1,
      unit: 'тр',
      unlocked: stats.totalWorkouts >= 1,
    },
    {
      id: 'workouts_10',
      category: 'strength',
      emoji: '💪',
      title: 'Регулярный атлет',
      description: 'Провести 10 тренировок',
      currentValue: Math.min(10, stats.totalWorkouts),
      targetValue: 10,
      unit: 'тр',
      unlocked: stats.totalWorkouts >= 10,
    },
    {
      id: 'heavy_100',
      category: 'strength',
      emoji: '🏋️‍♂️',
      title: 'Клуб 100 кг',
      description: 'Сделать подход с весом 100 кг или более',
      currentValue: Math.min(100, stats.maxWeightLifted),
      targetValue: 100,
      unit: 'кг',
      unlocked: stats.maxWeightLifted >= 100,
    },
    {
      id: 'tonnage_1000',
      category: 'strength',
      emoji: '🚜',
      title: 'Тоннаж 1000 кг',
      description: 'Поднять суммарно 1 тонну за одну тренировку',
      currentValue: Math.min(1000, stats.maxSingleWorkoutTonnage),
      targetValue: 1000,
      unit: 'кг',
      unlocked: stats.maxSingleWorkoutTonnage >= 1000,
    },

    // --- СТРИК И ЦЕПОЧКА ---
    {
      id: 'streak_3',
      category: 'streak',
      emoji: '⚡',
      title: 'Импульс',
      description: 'Удержать цепочку тренировок 3 дня',
      currentValue: Math.min(3, Math.max(stats.currentStreakDays, stats.bestStreakDays)),
      targetValue: 3,
      unit: 'дн',
      unlocked: Math.max(stats.currentStreakDays, stats.bestStreakDays) >= 3,
    },
    {
      id: 'streak_7',
      category: 'streak',
      emoji: '🔥',
      title: 'Железная воля',
      description: 'Удержать цепочку тренировок 7 дней',
      currentValue: Math.min(7, Math.max(stats.currentStreakDays, stats.bestStreakDays)),
      targetValue: 7,
      unit: 'дн',
      unlocked: Math.max(stats.currentStreakDays, stats.bestStreakDays) >= 7,
    },
    {
      id: 'streak_14',
      category: 'streak',
      emoji: '🛡',
      title: 'Титан дисциплины',
      description: 'Удержать цепочку тренировок 14 дней',
      currentValue: Math.min(14, Math.max(stats.currentStreakDays, stats.bestStreakDays)),
      targetValue: 14,
      unit: 'дн',
      unlocked: Math.max(stats.currentStreakDays, stats.bestStreakDays) >= 14,
    },

    // --- ВОДА И РЕЖИМ ---
    {
      id: 'water_3',
      category: 'water',
      emoji: '💧',
      title: 'Чистый баланс',
      description: 'Выполнить норму воды 3 дня подряд',
      currentValue: Math.min(3, stats.consecutiveWaterDays),
      targetValue: 3,
      unit: 'дн',
      unlocked: stats.consecutiveWaterDays >= 3,
    },
    {
      id: 'water_7',
      category: 'water',
      emoji: '🌊',
      title: 'Аквамен',
      description: 'Выполнить норму воды 7 дней подряд',
      currentValue: Math.min(7, stats.consecutiveWaterDays),
      targetValue: 7,
      unit: 'дн',
      unlocked: stats.consecutiveWaterDays >= 7,
    },

    // --- ТРАНСФОРМАЦИЯ ВЕСА ---
    {
      id: 'weight_3',
      category: 'weight',
      emoji: '📉',
      title: 'Первые минус 3 кг',
      description: 'Сбросить 3 кг от начального веса',
      currentValue: Math.max(0, Math.min(3, stats.weightLossKg)),
      targetValue: 3,
      unit: 'кг',
      unlocked: stats.weightLossKg >= 3,
    },
    {
      id: 'weight_5',
      category: 'weight',
      emoji: '🏆',
      title: 'Минус 5 кг',
      description: 'Сбросить 5 кг чистой динамики веса',
      currentValue: Math.max(0, Math.min(5, stats.weightLossKg)),
      targetValue: 5,
      unit: 'кг',
      unlocked: stats.weightLossKg >= 5,
    },
  ];

  return badges;
}

/**
 * Форматирует витрину наград в Telegram.
 */
export function formatBadgesShowcase(badges: Badge[]): string {
  const unlocked = badges.filter((b) => b.unlocked);
  const total = badges.length;

  const lines = [
    `🏆 *Витрина достижений gym95*`,
    `Открыто: *${unlocked.length} из ${total}* (${Math.round((unlocked.length / total) * 100)}%)`,
    '',
  ];

  if (unlocked.length > 0) {
    lines.push('✅ *Полученные награды:*');
    for (const b of unlocked) {
      lines.push(`${b.emoji} *${b.title}* — ${b.description}`);
    }
    lines.push('');
  }

  const locked = badges.filter((b) => !b.unlocked);
  if (locked.length > 0) {
    lines.push('🔒 *В процессе выполнения:*');
    for (const b of locked) {
      const pct = Math.round((b.currentValue / b.targetValue) * 100);
      lines.push(
        `▫️ *${b.title}*: ${b.currentValue}/${b.targetValue} ${b.unit} (${pct}%)\n   _${b.description}_`
      );
    }
  }

  return lines.join('\n');
}
