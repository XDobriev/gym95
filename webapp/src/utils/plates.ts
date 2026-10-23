// Калькулятор блинов на штангу и разминочной пирамиды для Gym95 WebApp

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

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export const BAR_WEIGHT_OPTIONS = [
  { id: 'olympic', label: '20 кг (Олимпийский)', weight: 20 },
  { id: 'women', label: '15 кг (Юниор/Фитнес)', weight: 15 },
  { id: 'ez', label: '10 кг (EZ-гриф)', weight: 10 },
  { id: 'smith', label: '0 кг (Тренажёр / Смит)', weight: 0 },
];

/**
 * Рассчитывает блины с каждой стороны грифа.
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
 * Рассчитывает разминочные подходы перед рабочим весом.
 */
export function calculateWarmupSets(workingWeightKg: number, barWeightKg = 20): WarmupSet[] {
  if (workingWeightKg <= barWeightKg || workingWeightKg <= 0) {
    return [
      {
        setNumber: 1,
        percent: 100,
        weightKg: Math.max(barWeightKg, workingWeightKg),
        reps: 10,
        note: 'Разминка с легким весом',
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
      note: 'Пустой гриф — суставная разминка',
    },
  ];

  const diff = workingWeightKg - barWeightKg;

  if (diff >= 40) {
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
      note: 'Примерка веса',
    });
  } else if (diff >= 20) {
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
      note: 'Активация',
    });
  } else {
    warmup.push({
      setNumber: 2,
      percent: 75,
      weightKg: roundTo2_5(workingWeightKg * 0.75),
      reps: 4,
      note: 'Разминочный подход',
    });
  }

  // Фильтрация дублей
  const deduped: WarmupSet[] = [];
  const seen = new Set<number>();
  for (const s of warmup) {
    if (!seen.has(s.weightKg) && s.weightKg < workingWeightKg) {
      seen.add(s.weightKg);
      deduped.push({ ...s, setNumber: deduped.length + 1 });
    }
  }

  return deduped;
}

/**
 * Краткая текстовая раскладка блинов для карточки (например: "25 + 5 + 1.25 кг").
 */
export function formatPlatesShort(result: PlatesResult): string {
  if (result.platesPerSide.length === 0) {
    return 'Без блинов';
  }
  return result.platesPerSide
    .map((p) => (p.countPerSide > 1 ? `${p.countPerSide}×${p.plateKg}` : `${p.plateKg}`))
    .join(' + ') + ' кг/бок';
}
