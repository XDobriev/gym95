import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveSession,
  recordActiveSessionSet,
  startDraft,
  clearDraft,
} from '../handlers/workout/state';

test('getActiveSession: возвращает active: false если нет начатой тренировки', () => {
  const testUserId = 999101;
  clearDraft(testUserId);
  const session = getActiveSession(testUserId);
  assert.equal(session.active, false);
  assert.equal(session.exercises.length, 0);
});

test('getActiveSession: возвращает детали сессии если черновик создан', () => {
  const testUserId = 999102;
  clearDraft(testUserId);
  const draft = startDraft(testUserId, 123456);
  draft.templateId = 'tpl_fullbody_a';
  draft.templateName = 'Фулбади A';
  draft.currentExerciseName = 'Жим штанги лёжа';
  draft.exercises = [
    {
      name: 'Жим штанги лёжа',
      sets: [
        { weight: 80, reps: 10 },
        { weight: 80, reps: 10 },
      ],
      orderIndex: 0,
    },
  ];

  const session = getActiveSession(testUserId);
  assert.equal(session.active, true);
  assert.equal(session.templateId, 'tpl_fullbody_a');
  assert.equal(session.templateName, 'Фулбади A');
  assert.equal(session.currentExerciseName, 'Жим штанги лёжа');
  assert.equal(session.exercises.length, 1);
  assert.equal(session.exercises[0].name, 'Жим штанги лёжа');
  assert.equal(session.exercises[0].sets.length, 2);
  assert.equal(session.exercises[0].sets[0].weight, 80);
  assert.equal(session.exercises[0].sets[0].reps, 10);
  assert.equal(session.exercises[0].sets[0].completed, true);

  clearDraft(testUserId);
});

test('getActiveSession: возвращает active: true если начато упражнение в виджете, даже без выполненных подходов', () => {
  const testUserId = 999105;
  clearDraft(testUserId);
  const draft = startDraft(testUserId, 123456);
  draft.currentExerciseName = 'Становая тяга';
  draft.widgetMessageId = 777123;

  const session = getActiveSession(testUserId);
  assert.equal(session.active, true);
  assert.equal(session.currentExerciseName, 'Становая тяга');
  assert.equal(session.exercises.length, 1);
  assert.equal(session.exercises[0].name, 'Становая тяга');
  assert.equal(session.exercises[0].sets.length, 0);

  clearDraft(testUserId);
});

test('recordActiveSessionSet: добавляет подход и синхронизирует состояние', async () => {
  const testUserId = 999103;
  clearDraft(testUserId);

  const res = await recordActiveSessionSet(testUserId, {
    exerciseName: 'Приседания со штангой',
    weight: 100,
    reps: 8,
  });

  assert.equal(res.ok, true);
  assert.equal(res.session.active, true);
  assert.equal(res.session.exercises.length, 1);
  assert.equal(res.session.exercises[0].name, 'Приседания со штангой');
  assert.equal(res.session.exercises[0].sets.length, 1);
  assert.equal(res.session.exercises[0].sets[0].weight, 100);
  assert.equal(res.session.exercises[0].sets[0].reps, 8);

  // Добавляем второй подход в то же упражнение
  const res2 = await recordActiveSessionSet(testUserId, {
    exerciseName: 'Приседания со штангой',
    weight: 100,
    reps: 8,
  });

  assert.equal(res2.session.exercises[0].sets.length, 2);

  // Добавляем новое упражнение
  const res3 = await recordActiveSessionSet(testUserId, {
    exerciseName: 'Жим ногами',
    weight: 160,
    reps: 12,
  });

  assert.equal(res3.session.exercises.length, 2);
  assert.equal(res3.session.exercises[1].name, 'Жим ногами');
  assert.equal(res3.session.exercises[1].sets[0].weight, 160);

  clearDraft(testUserId);
});

test('recordActiveSessionSet: обновляет виджет если widgetMessageId привязан к сессии', async () => {
  const testUserId = 999104;
  clearDraft(testUserId);

  const draft = startDraft(testUserId, 555000);
  draft.widgetMessageId = 888111;

  const res = await recordActiveSessionSet(testUserId, {
    exerciseName: 'Тяга верхнего блока',
    weight: 60,
    reps: 12,
  });

  assert.equal(res.ok, true);
  assert.equal(typeof res.widgetUpdated, 'boolean');

  clearDraft(testUserId);
});
