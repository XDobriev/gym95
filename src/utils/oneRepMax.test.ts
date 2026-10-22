import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate1RM, calculateExerciseStats, formatExerciseStatsSummary } from './oneRepMax';

test('calculate1RM: граничные случаи и 1 повторение', () => {
  assert.equal(calculate1RM(0, 10), 0);
  assert.equal(calculate1RM(100, 0), 0);
  assert.equal(calculate1RM(-50, 5), 0);
  assert.equal(calculate1RM(100, 1), 100);
});

test('calculate1RM: формула Эпли', () => {
  // 100 кг на 10 повторений: 100 * (1 + 10/30) = 133.33 -> 133.3
  assert.equal(calculate1RM(100, 10), 133.3);
  // 80 кг на 5 повторений: 80 * (1 + 5/30) = 80 * (1 + 0.1666) = 93.33 -> 93.3
  assert.equal(calculate1RM(80, 5), 93.3);
  // 60 кг на 6 повторений: 60 * (1 + 6/30) = 60 * 1.2 = 72
  assert.equal(calculate1RM(60, 6), 72);
});

test('calculateExerciseStats: прогресс и прирост силы', () => {
  const history = [
    {
      date: '2026-10-01',
      sets: [
        { weight: 60, reps: 10 }, // 1RM = 80
        { weight: 60, reps: 8 },
      ],
    },
    {
      date: '2026-10-15',
      sets: [
        { weight: 70, reps: 8 }, // 70 * (1 + 8/30) = 88.7
        { weight: 75, reps: 5 }, // 75 * (1 + 5/30) = 87.5
      ],
    },
    {
      date: '2026-10-22',
      sets: [
        { weight: 80, reps: 6 }, // 80 * (1 + 6/30) = 96
        { weight: 85, reps: 3 }, // 85 * (1 + 3/30) = 93.5
      ],
    },
  ];

  const stats = calculateExerciseStats(history);
  assert.equal(stats.isBodyweight, false);
  assert.equal(stats.totalWorkouts, 3);
  assert.equal(stats.totalSets, 6);
  assert.equal(stats.allTimeBest1RM?.oneRepMax, 96);
  assert.equal(stats.allTimeBest1RM?.weight, 80);
  assert.equal(stats.allTimeBest1RM?.reps, 6);
  assert.equal(stats.maxWeightSet?.weight, 85);
  assert.equal(stats.growthKg, 16); // 96 - 80 = 16
  assert.equal(stats.growthPct, 20); // 16 / 80 * 100 = 20%

  const summary = formatExerciseStatsSummary(stats);
  assert.ok(summary.some((s) => s.includes('Рекордный 1RM: 96 кг')));
  assert.ok(summary.some((s) => s.includes('Макс. вес: 85 кг')));
  assert.ok(summary.some((s) => s.includes('Прирост силы: +16 кг (+20%)')));
});

test('calculateExerciseStats: упражнение со своим весом', () => {
  const history = [
    {
      date: '2026-10-01',
      sets: [
        { weight: 0, reps: 12 },
        { weight: 0, reps: 10 },
      ],
    },
    {
      date: '2026-10-15',
      sets: [{ weight: 0, reps: 18 }],
    },
  ];

  const stats = calculateExerciseStats(history);
  assert.equal(stats.isBodyweight, true);
  assert.equal(stats.maxRepsSet?.reps, 18);

  const summary = formatExerciseStatsSummary(stats);
  assert.ok(summary.some((s) => s.includes('Рекорд повторений: 18 повт.')));
});
