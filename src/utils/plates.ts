// Калькулятор блинов на штангу и прогрессии разминочных подходов

export interface PlateCount {
  plateKg: number;
  countPerSide: number;
}

export interface PlatesResult {
  targetWeightKg: number;
  barWeightKg: number;
  weightOnBarKg: number;
  weightPerSideKg: number;
  platesPerSide: PlateCount[];
  remainderKg: number;
}

export interface WarmupSet {
  setNumber: number;
  percent: number;
  weightKg: number;
  reps: number;
  note: string;
}

// Стандартный набор олимпийских блинов в залах (от тяжелых к легким)
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Рассчитывает, какие блины повесить на каждую сторону грифа.
 * @param targetWeightKg Целевой вес штанги
 * @param barWeightKg Вес грифа (по умолчанию 20 кг)
 * @param availablePlates Доступные блины
 */
export function calculatePlates(
  targetWeightKg: number,
  barWeightKg = 20,
  availablePlates = DEFAULT_PLATES
): PlatesResult {
  const sortedPlates = [...availablePlates].sort((a, b) => b - a);
  const weightOnBarKg = Math.max(0, targetWeightKg - barWeightKg);
  const targetPerSide = weightOnBarKg / 2;

  let remaining = targetPerSide;
  const platesPerSide: PlateCount[] = [];

  for (const plate of sortedPlates) {
    if (remaining >= plate) {
      const count = Math.floor(remaining / plate);
      platesPerSide.push({ plateKg: plate, countPerSide: count });
      remaining = Math.round((remaining - count * plate) * 100) / 100;
    }
  }

  return {
    targetWeightKg,
    barWeightKg,
    weightOnBarKg,
    weightPerSideKg: targetPerSide,
    platesPerSide,
    remainderKg: Math.round(remaining * 2 * 100) / 100,
  };
}

/**
 * Генерирует пирамиду разминочных подходов перед рабочим весом.
 * @param workingWeightKg Рабочий вес в упражнении
 * @param barWeightKg Вес пустого грифа
 */
export function calculateWarmupSets(workingWeightKg: number, barWeightKg = 20): WarmupSet[] {
  if (workingWeightKg <= barWeightKg) {
    return [
      {
        setNumber: 1,
        percent: 100,
        weightKg: workingWeightKg,
        reps: 10,
        note: 'Суставная разминка с пустым грифом или легким весом',
      },
    ];
  }

  const roundTo2_5 = (val: number) => Math.max(barWeightKg, Math.round(val / 2.5) * 2.5);

  const warmup: WarmupSet[] = [
    {
      setNumber: 1,
      percent: Math.round((barWeightKg / workingWeightKg) * 100),
      weightKg: barWeightKg,
      reps: 10,
      note: 'Пустой гриф — суставная разминка и траектория',
    },
  ];

  const diff = workingWeightKg - barWeightKg;

  if (diff >= 40) {
    // 4 шага разминки: 45%, 65%, 80%, 90%
    warmup.push({
      setNumber: 2,
      percent: 50,
      weightKg: roundTo2_5(workingWeightKg * 0.5),
      reps: 6,
      note: 'Втягивающий подход',
    });
    warmup.push({
      setNumber: 3,
      percent: 70,
      weightKg: roundTo2_5(workingWeightKg * 0.7),
      reps: 3,
      note: 'Активация ЦНС',
    });
    warmup.push({
      setNumber: 4,
      percent: 85,
      weightKg: roundTo2_5(workingWeightKg * 0.85),
      reps: 1,
      note: 'Финальная примерка веса перед рабочими',
    });
  } else if (diff >= 20) {
    // 2-3 шага разминки: 60%, 80%
    warmup.push({
      setNumber: 2,
      percent: 60,
      weightKg: roundTo2_5(workingWeightKg * 0.6),
      reps: 5,
      note: 'Втягивающий подход',
    });
    warmup.push({
      setNumber: 3,
      percent: 80,
      weightKg: roundTo2_5(workingWeightKg * 0.8),
      reps: 2,
      note: 'Активация перед рабочим весом',
    });
  } else {
    // 1 промежуточный подход
    warmup.push({
      setNumber: 2,
      percent: 75,
      weightKg: roundTo2_5(workingWeightKg * 0.75),
      reps: 4,
      note: 'Разминочный подход',
    });
  }

  // Фильтруем дубликаты по весу, если округление совпало
  const deduped: WarmupSet[] = [];
  const seenWeights = new Set<number>();
  for (const set of warmup) {
    if (!seenWeights.has(set.weightKg) && set.weightKg < workingWeightKg) {
      seenWeights.add(set.weightKg);
      deduped.push({ ...set, setNumber: deduped.length + 1 });
    }
  }

  return deduped;
}

/**
 * Форматирует текстовую раскладку блинов и схему разминки для Telegram.
 */
export function formatPlatesSummary(targetWeightKg: number, barWeightKg = 20): string {
  if (targetWeightKg < barWeightKg) {
    return `Вес ${targetWeightKg} кг меньше веса стандартного грифа (${barWeightKg} кг). Используй гантели или бодибар.`;
  }

  const plates = calculatePlates(targetWeightKg, barWeightKg);
  const warmups = calculateWarmupSets(targetWeightKg, barWeightKg);

  const lines: string[] = [
    `🏋️‍♂️ *Штанга: ${targetWeightKg} кг* (гриф ${barWeightKg} кг)`,
    `С каждой стороны: *${plates.weightPerSideKg} кг*`,
  ];

  if (plates.platesPerSide.length === 0) {
    lines.push('👉 Повесь: пустой гриф без блинов.');
  } else {
    const platesText = plates.platesPerSide
      .map((p) => `${p.countPerSide > 1 ? `${p.countPerSide}×` : ''}[${p.plateKg} кг]`)
      .join(' + ');
    lines.push(`👉 Повесь с каждой стороны:\n*${platesText}*`);
    if (plates.remainderKg > 0) {
      lines.push(`⚠️ Не хватает мелких блинов на ${plates.remainderKg} кг.`);
    }
  }

  lines.push('');
  lines.push('🔥 *Схема разминки перед рабочим весом:*');
  for (const w of warmups) {
    lines.push(`• Подход ${w.setNumber}: *${w.weightKg} кг* × ${w.reps} повт (${w.note})`);
  }
  lines.push(`🎯 *Рабочие подходы:* *${targetWeightKg} кг* на запланированные повторения!`);

  return lines.join('\n');
}
