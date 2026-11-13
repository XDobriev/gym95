import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDoubleProgression,
  diagnosePlateau,
  isLowerBodyOrCompound,
  formatWeeklyReport,
  WeeklyReportData,
} from './progressionCoach';

test('isLowerBodyOrCompound: корректно определяет приседания, тяги и жим ногами', () => {
  assert.equal(isLowerBodyOrCompound('Приседания со штангой'), true);
  assert.equal(isLowerBodyOrCompound('Становая тяга'), true);
  assert.equal(isLowerBodyOrCompound('Жим ногами'), true);
  assert.equal(isLowerBodyOrCompound('Румынская тяга с гантелями'), true);
  assert.equal(isLowerBodyOrCompound('Сгибание ног сидя'), true);
  assert.equal(isLowerBodyOrCompound('Разгибание ног в тренажере'), true);
  assert.equal(isLowerBodyOrCompound('Жим штанги лёжа'), false);
  assert.equal(isLowerBodyOrCompound('Подтягивания'), false);
  assert.equal(isLowerBodyOrCompound('Махи гантелями в стороны'), false);
  assert.equal(isLowerBodyOrCompound('Сгибание рук на бицепс'), false);
  assert.equal(isLowerBodyOrCompound('Разгибание рук на трицепс'), false);
  assert.equal(isLowerBodyOrCompound('Тяга верхнего блока'), false);
  assert.equal(isLowerBodyOrCompound('Тяга гантели к поясу'), false);
});

test('calculateDoubleProgression: все сеты закрыты на максимум — прибавка +2.5 кг для верха', () => {
  const sets = [
    { weight: 80, reps: 10 },
    { weight: 80, reps: 10 },
    { weight: 80, reps: 10 },
  ];
  const res = calculateDoubleProgression('Жим штанги лёжа', sets, { minReps: 8, maxReps: 10 });
  assert.ok(res);
  assert.equal(res.achievedTarget, true);
  assert.equal(res.currentWorkingWeight, 80);
  assert.equal(res.recommendedWeight, 82.5);
  assert.equal(res.weightIncrement, 2.5);
  assert.ok(res.advice.includes('+2.5 кг'));
});

test('calculateDoubleProgression: все сеты закрыты на максимум — прибавка +5.0 кг для приседа', () => {
  const sets = [
    { weight: 100, reps: 8 },
    { weight: 100, reps: 8 },
    { weight: 100, reps: 8 },
  ];
  const res = calculateDoubleProgression('Приседания со штангой', sets, { minReps: 6, maxReps: 8 });
  assert.ok(res);
  assert.equal(res.achievedTarget, true);
  assert.equal(res.recommendedWeight, 105);
  assert.equal(res.weightIncrement, 5);
  assert.ok(res.advice.includes('+5 кг'));
});

test('calculateDoubleProgression: легкий вес (< 16 кг) — аккуратный шаг +1 кг', () => {
  const sets = [
    { weight: 12, reps: 12 },
    { weight: 12, reps: 12 },
  ];
  const res = calculateDoubleProgression('Подъём гантелей на бицепс', sets, 12);
  assert.ok(res);
  assert.equal(res.achievedTarget, true);
  assert.equal(res.recommendedWeight, 13);
  assert.equal(res.weightIncrement, 1);
});

test('calculateDoubleProgression: сеты не закрыты на максимум — сохраняем вес', () => {
  const sets = [
    { weight: 90, reps: 10 },
    { weight: 90, reps: 9 },
    { weight: 90, reps: 8 },
  ];
  const res = calculateDoubleProgression('Жим штанги лёжа', sets, { minReps: 8, maxReps: 10 });
  assert.ok(res);
  assert.equal(res.achievedTarget, false);
  assert.equal(res.recommendedWeight, 90);
  assert.equal(res.weightIncrement, 0);
  assert.ok(res.advice.includes('Держи вес 90 кг'));
});

test('diagnosePlateau: обнаруживает застой веса на протяжении 3+ недель', () => {
  const history = [
    { date: '2026-10-01T10:00:00Z', sets: [{ weight: 100, reps: 6 }] },
    { date: '2026-10-08T10:00:00Z', sets: [{ weight: 100, reps: 6 }] },
    { date: '2026-10-15T10:00:00Z', sets: [{ weight: 100, reps: 6 }] },
    { date: '2026-10-24T10:00:00Z', sets: [{ weight: 100, reps: 5 }] },
  ];

  const diag = diagnosePlateau('Жим штанги лёжа', history);
  assert.ok(diag);
  assert.equal(diag.hasPlateau, true);
  assert.ok(diag.durationWeeks >= 3);
  assert.ok(diag.recommendations.deload.includes('Делоад'));
  assert.ok(diag.recommendations.repRange.includes('Смена диапазона'));
});

test('diagnosePlateau: не диагностирует плато при растущем 1RM', () => {
  const history = [
    { date: '2026-10-01T10:00:00Z', sets: [{ weight: 100, reps: 6 }] },
    { date: '2026-10-10T10:00:00Z', sets: [{ weight: 102.5, reps: 6 }] },
    { date: '2026-10-25T10:00:00Z', sets: [{ weight: 107.5, reps: 6 }] },
  ];

  const diag = diagnosePlateau('Жим штанги лёжа', history);
  assert.ok(diag);
  assert.equal(diag.hasPlateau, false);
});

test('formatWeeklyReport: красиво форматирует дайджест с тоннажем и рекордами', () => {
  const report: WeeklyReportData = {
    weekStart: '2026-11-03',
    weekEnd: '2026-11-10',
    totalWorkouts: 4,
    strengthWorkouts: 3,
    cardioWorkouts: 1,
    totalTonnageKg: 28450,
    totalCardioKm: 5.2,
    topPrProgress: [
      { exercise: 'Жим штанги лёжа', new1RM: 115, deltaKg: 5, percent: 5 },
      { exercise: 'Приседания со штангой', new1RM: 145, deltaKg: 7.5, percent: 5 },
    ],
    recovery: {
      avgSleepHours: 7.8,
      sleepRating: 'good',
      waterAvgPercent: 95,
      foodAvgKcal: 2350,
      foodNormKcal: 2400,
    },
    coachSummary: 'Отличная неделя!',
  };

  const text = formatWeeklyReport(report);
  assert.ok(text.includes('ЕЖЕНЕДЕЛЬНЫЙ ДАЙДЖЕСТ GYM95'));
  assert.ok(text.includes('28 450 кг'));
  assert.ok(text.includes('5.2 км'));
  assert.ok(text.includes('Жим штанги лёжа'));
  assert.ok(text.includes('7.8 ч/ночь'));
  assert.ok(text.includes('Отличная неделя!'));
});
