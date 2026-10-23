import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLiveWorkoutPayload } from './live';

test('validateLiveWorkoutPayload: отклоняет невалидное тело (не объект)', () => {
  assert.equal(validateLiveWorkoutPayload(null).ok, false);
  assert.equal(validateLiveWorkoutPayload('string').ok, false);
  assert.equal(validateLiveWorkoutPayload(undefined).ok, false);
});

test('validateLiveWorkoutPayload: отклоняет пустой список упражнений', () => {
  const result = validateLiveWorkoutPayload({
    durationMinutes: 45,
    exercises: [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /упражнени/i);
  }
});

test('validateLiveWorkoutPayload: отклоняет тренировку, где все подходы не завершены', () => {
  const result = validateLiveWorkoutPayload({
    durationMinutes: 45,
    exercises: [
      {
        name: 'Жим лёжа',
        sets: [
          { weight: 80, reps: 10, completed: false },
        ],
      },
    ],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /подход/i);
  }
});

test('validateLiveWorkoutPayload: успешно валидирует корректную силовую сессию', () => {
  const result = validateLiveWorkoutPayload({
    durationMinutes: 45,
    warmupMinutes: 5,
    notes: 'Отличная тренировка',
    exercises: [
      {
        name: 'Жим лёжа',
        sets: [
          { weight: 80, reps: 10, completed: true },
          { weight: 85, reps: 8, completed: true },
          { weight: 90, reps: 5, completed: false }, // отфильтруется
        ],
      },
    ],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.durationMinutes, 45);
    assert.equal(result.data.warmupMinutes, 5);
    assert.equal(result.data.notes, 'Отличная тренировка');
    assert.equal(result.data.exercises.length, 1);
    assert.equal(result.data.exercises[0].sets.length, 2);
    assert.equal(result.data.exercises[0].sets[0].weight, 80);
    assert.equal(result.data.exercises[0].sets[0].reps, 10);
  }
});
