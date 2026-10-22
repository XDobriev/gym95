// Расчет рациона, целевого БЖУ и продуктовой корзины под цели пользователя (похудение, поддержание, набор)

export interface MacroTarget {
  dailyKcal: number;
  proteinG: number;
  fatsG: number;
  carbsG: number;
  waterLiters: number;
}

export interface GroceryItem {
  name: string;
  category: 'Белок' | 'Углеводы' | 'Жиры' | 'Клетчатка и витамины';
  weeklyAmount: string;
  notes: string;
}

export interface DietPlanResult {
  macros: MacroTarget;
  weeklyGroceries: GroceryItem[];
  mealDistribution: {
    mealName: string;
    kcalPercent: number;
    kcal: number;
    proteinG: number;
    example: string;
  }[];
}

/**
 * Рассчитывает целевое БЖУ и корзину продуктов на неделю.
 */
export function calculateDietPlan(
  weightKg: number,
  dailyKcal: number,
  goal: 'lose' | 'gain' | 'regular' = 'lose'
): DietPlanResult {
  // Белок: для похудения выше (1.8-2.0 г/кг) для сохранения мышц, для поддержания 1.5, для набора 1.8-2.0
  const proteinMultiplier = goal === 'lose' ? 1.9 : goal === 'gain' ? 1.8 : 1.5;
  const proteinG = Math.round(weightKg * proteinMultiplier);
  const proteinKcal = proteinG * 4;

  // Жиры: 0.8 - 0.9 г/кг для нормальной гормональной системы
  const fatMultiplier = goal === 'lose' ? 0.8 : 0.9;
  const fatsG = Math.round(weightKg * fatMultiplier);
  const fatsKcal = fatsG * 9;

  // Углеводы: остаток калорий
  const remainingKcal = Math.max(0, dailyKcal - proteinKcal - fatsKcal);
  const carbsG = Math.round(remainingKcal / 4);

  // Вода: 30-35 мл на кг веса
  const waterLiters = Math.round((weightKg * 0.033) * 10) / 10;

  const macros: MacroTarget = {
    dailyKcal,
    proteinG,
    fatsG,
    carbsG,
    waterLiters,
  };

  // Расчет продуктовой корзины на 7 дней
  // Куриное филе/индейка (22г белка на 100г сырого продукта): покрывает ~50-60% белка
  const weeklyPoultryKg = Math.round((proteinG * 0.5 * 7 / 220) * 10) / 10;
  // Яйца (12г белка в 2 шт): 2 яйца в день = 14 шт ~ 1.5 десятка
  const weeklyEggs = Math.ceil((7 * 2) / 10) * 10;
  // Творог 5% (16-18г белка на 100г): 1 пачка 180г через день или каждый день
  const weeklyCottagePacks = goal === 'lose' ? 5 : 4;
  // Крупы (гречка, рис, овсянка): сырой вес из расчета углеводов
  const weeklyGrainsKg = Math.max(1, Math.round((carbsG * 0.65 * 7 / 700) * 10) / 10);

  const weeklyGroceries: GroceryItem[] = [
    {
      name: 'Куриная грудка или филе индейки',
      category: 'Белок',
      weeklyAmount: `~${weeklyPoultryKg} кг`,
      notes: 'Основной нежирный источник белка',
    },
    {
      name: 'Яйца куриные (кат. C1/C0)',
      category: 'Белок',
      weeklyAmount: `${weeklyEggs} шт (${weeklyEggs / 10} дес.)`,
      notes: '2-3 яйца на завтрак (отварные или яичница)',
    },
    {
      name: 'Творог 5% (или 2%)',
      category: 'Белок',
      weeklyAmount: `${weeklyCottagePacks} пачек по 180г`,
      notes: 'Отличный вечерний белок (медленный казеин)',
    },
    {
      name: 'Гречневая крупа / Бурый рис / Овсянка',
      category: 'Углеводы',
      weeklyAmount: `~${weeklyGrainsKg} кг (в сумме)`,
      notes: 'Сложные углеводы для энергии и сытости',
    },
    {
      name: 'Овощи (огурцы, помидоры, кабачки, брокколи, зелень)',
      category: 'Клетчатка и витамины',
      weeklyAmount: '~2.5 – 3.0 кг',
      notes: 'Минимум калорий, максимум объема и клетчатки в каждый прием',
    },
    {
      name: 'Оливковое или льняное масло',
      category: 'Жиры',
      weeklyAmount: '1 бутылка (хватит на месяц)',
      notes: '1 столовая ложка в день в салат (полезные жиры)',
    },
    {
      name: 'Фрукты / ягоды (яблоки, ягоды, бананы)',
      category: 'Клетчатка и витамины',
      weeklyAmount: '~1.5 кг',
      notes: '1-2 фрукта в первой половине дня или перед тренировкой',
    },
  ];

  // Примерное распределение калорий на 4 приема
  const mealDistribution = [
    {
      mealName: 'Завтрак',
      kcalPercent: 25,
      kcal: Math.round(dailyKcal * 0.25),
      proteinG: Math.round(proteinG * 0.25),
      example: 'Овсянка на воде/молоке с ягодами + 2 вареных яйца',
    },
    {
      mealName: 'Обед',
      kcalPercent: 35,
      kcal: Math.round(dailyKcal * 0.35),
      proteinG: Math.round(proteinG * 0.35),
      example: 'Куриное филе (150-180г) + гречка (60-70г сухой) + свежий салат',
    },
    {
      mealName: 'Полдник / Перекус',
      kcalPercent: 15,
      kcal: Math.round(dailyKcal * 0.15),
      proteinG: Math.round(proteinG * 0.15),
      example: 'Яблоко + горсть миндаля (15-20г) или протеиновый батончик',
    },
    {
      mealName: 'Ужин',
      kcalPercent: 25,
      kcal: Math.round(dailyKcal * 0.25),
      proteinG: Math.round(proteinG * 0.25),
      example: 'Филе индейки или белая рыба + тушеные овощи / брокколи или пачка творога 5%',
    },
  ];

  return {
    macros,
    weeklyGroceries,
    mealDistribution,
  };
}

/**
 * Форматирует сводку рациона для Telegram.
 */
export function formatDietPlanSummary(
  weightKg: number,
  dailyKcal: number,
  goal: 'lose' | 'gain' | 'regular' = 'lose'
): string {
  const plan = calculateDietPlan(weightKg, dailyKcal, goal);
  const goalText =
    goal === 'lose' ? '🔥 Снижение веса (дефицит)' : goal === 'gain' ? '💪 Набор массы' : '⚖️ Поддержание веса';

  const lines = [
    `🥗 *План питания и БЖУ под цель*`,
    `Цель: *${goalText}*`,
    `Твой вес: *${weightKg} кг*`,
    '',
    `🎯 *Суточная норма:*`,
    `• Калории: *${plan.macros.dailyKcal} ккал*`,
    `• Белки: *${plan.macros.proteinG} г* (~${Math.round((plan.macros.proteinG / weightKg) * 10) / 10} г/кг)`,
    `• Жиры: *${plan.macros.fatsG} г* (~${Math.round((plan.macros.fatsG / weightKg) * 10) / 10} г/кг)`,
    `• Углеводы: *${plan.macros.carbsG} г*`,
    `• Вода: *${plan.macros.waterLiters} л* в день`,
    '',
    `🍽 *Распределение по приемам пищи:*`,
  ];

  for (const m of plan.mealDistribution) {
    lines.push(`• *${m.mealName}* (~${m.kcal} ккал, белок ~${m.proteinG} г):\n  _${m.example}_`);
  }

  lines.push('');
  lines.push('🛒 Для списка продуктов на неделю нажми кнопку ниже:');

  return lines.join('\n');
}

/**
 * Форматирует список покупок на неделю для похода в магазин.
 */
export function formatGroceriesList(
  weightKg: number,
  dailyKcal: number,
  goal: 'lose' | 'gain' | 'regular' = 'lose'
): string {
  const plan = calculateDietPlan(weightKg, dailyKcal, goal);

  const lines = [
    `🛒 *Список продуктов на неделю (${plan.macros.dailyKcal} ккал/день):*`,
    '',
  ];

  const categories = ['Белок', 'Углеводы', 'Жиры', 'Клетчатка и витамины'] as const;

  for (const cat of categories) {
    const items = plan.weeklyGroceries.filter((i) => i.category === cat);
    if (items.length > 0) {
      lines.push(`*${cat}:*`);
      for (const item of items) {
        lines.push(`  ▫️ *${item.name}* — ${item.weeklyAmount}\n     _${item.notes}_`);
      }
      lines.push('');
    }
  }

  lines.push('💡 *Совет:* Закупай продукты на 3-4 дня вперед и готовь крупы и птицу порционно в контейнеры — это исключает случайные срывы в питании!');

  return lines.join('\n');
}

