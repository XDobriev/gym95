import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSessionVolume,
  filterCompletedExercises,
  getGhostValues,
  calculateLive1RM,
} from './liveWorkout';

test('calculateSessionVolume: суммирует только завершённые подходы с весом и повторениями', () => {
  const exercises = [
    {
      name: 'Жим лёжа',
      sets: [
        { weight: 80, reps: 10, completed: true },
        { weight: 85, reps: 8, completed: true },
        { weight: 90, reps: 6, completed: false }, // не завершён
      ],
    },
    {
      name: 'Подтягивания',
      sets: [
        { weight: 0, reps: 10, completed: true }, // вес 0 — в тоннаж не идёт
      ],
    },
  ];

  const volume = calculateSessionVolume(exercises);
  // (80*10) + (85*8) = 800 + 680 = 1480
  assert.equal(volume, 1480);
});

test('filterCompletedExercises: исключает пустые и незавершённые подходы и упражнения', () => {
  const exercises = [
    {
      name: 'Жим лёжа',
      sets: [
        { weight: 80, reps: 10, completed: true },
        { weight: 85, reps: 0, completed: true }, // 0 повторений
        { weight: 90, reps: 5, completed: false }, // не нажат чекбокс
      ],
    },
    {
      name: 'Присед',
      sets: [
        { weight: 100, reps: 5, completed: false }, // все не завершены
      ],
    },
  ];

  const filtered = filterCompletedExercises(exercises);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Жим лёжа');
  assert.equal(filtered[0].sets.length, 1);
  assert.deepEqual(filtered[0].sets[0], { weight: 80, reps: 10, completed: true });
});

test('getGhostValues: возвращает значения из прошлой тренировки или дефолтные', () => {
  const pastExercises = [
    {
      name: 'Жим лёжа',
      sets: [
        { weight: 80, reps: 10 },
        { weight: 85, reps: 8 },
      ],
    },
  ];

  const ghostSet0 = getGhostValues(pastExercises, 'Жим лёжа', 0);
  assert.deepEqual(ghostSet0, { weight: 80, reps: 10 });

  const ghostSet1 = getGhostValues(pastExercises, 'Жим лёжа', 1);
  assert.deepEqual(ghostSet1, { weight: 85, reps: 8 });

  // Если подходов в прошлый раз было меньше — берём последний подход
  const ghostSet2 = getGhostValues(pastExercises, 'Жим лёжа', 2);
  assert.deepEqual(ghostSet2, { weight: 85, reps: 8 });

  // Если упражнения не было — дефолтные 0 кг и 10 повт
  const ghostUnknown = getGhostValues(pastExercises, 'Становая тяга', 0);
  assert.deepEqual(ghostUnknown, { weight: 0, reps: 10 });
});

test('calculateLive1RM: считает 1RM по Эпли с округлением до 0.5 кг', () => {
  // 100 кг на 10 повторений -> 100 * (1 + 10/30) = 133.33 -> 133.5
  assert.equal(calculateLive1RM(100, 10), 133.5);
  // 100 кг на 1 повторение -> 100
  assert.equal(calculateLive1RM(100, 1), 100);
  // 0 кг -> 0
  assert.equal(calculateLive1RM(0, 10), 0);
});
