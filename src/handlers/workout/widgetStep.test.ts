import test from 'node:test';
import assert from 'node:assert/strict';
import { sendExerciseWidget, handleWidgetQuery } from './widgetStep';
import { startDraft, clearDraft, getDraft } from './state';
import { WidgetQueryData } from '../../utils/telegramWidgets';

test('sendExerciseWidget: successfully sends widget and sets draft state', async () => {
  const userId = 777001;
  const chatId = 888001;
  clearDraft(userId);
  const draft = startDraft(userId, chatId);

  const calls: { method: string; data: any }[] = [];
  const mockCtx: any = {
    from: { id: userId },
    chat: { id: chatId },
    telegram: {
      callApi: async (method: any, data: any) => {
        calls.push({ method, data });
        return { message_id: 555 };
      },
    },
  };

  const success = await sendExerciseWidget(mockCtx, 'Жим лёжа');
  assert.equal(success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'sendWidget');
  assert.equal(calls[0].data.chat_id, chatId);
  assert.equal(draft.widgetMessageId, 555);
  assert.equal(draft.currentExerciseName, 'Жим лёжа');
  assert.equal(draft.step, 'entering_sets');

  clearDraft(userId);
});

test('sendExerciseWidget: gracefully falls back to promptSetsForExercise when sendWidget fails', async () => {
  const userId = 777002;
  const chatId = 888002;
  clearDraft(userId);
  const draft = startDraft(userId, chatId);

  const editCalls: any[] = [];
  const mockCtx: any = {
    from: { id: userId },
    chat: { id: chatId },
    editMessageText: async (text: string, extra: any) => {
      editCalls.push({ text, extra });
    },
    reply: async (text: string, extra: any) => {
      editCalls.push({ text, extra });
    },
    telegram: {
      callApi: async () => {
        throw new Error('Telegram Bot API 10.4 sendWidget not supported');
      },
    },
  };

  const success = await sendExerciseWidget(mockCtx, 'Тяга блока', true);
  assert.equal(success, false);
  assert.equal(draft.useWidget, false);
  assert.ok(editCalls.length > 0);
  assert.ok(editCalls[0].text.includes('Тяга блока'));

  clearDraft(userId);
});

test('handleWidgetQuery: finish_set saves set into draft and updates widget data', async () => {
  const userId = 777003;
  const chatId = 888003;
  clearDraft(userId);
  const draft = startDraft(userId, chatId);
  draft.currentExerciseName = 'Приседания';

  const apiCalls: { method: string; data: any }[] = [];
  const mockCtx: any = {
    telegram: {
      callApi: async (method: any, data: any) => {
        apiCalls.push({ method, data });
        return true;
      },
    },
  };

  const query: WidgetQueryData = {
    id: 'query_123',
    from: { id: userId, first_name: 'Test' },
    message: {
      message_id: 111,
      chat: { id: chatId, type: 'private' },
    },
    data: JSON.stringify({
      action: 'finish_set',
      weight: 100,
      reps: 8,
      setIndex: 1,
    }),
  };

  await handleWidgetQuery(mockCtx, query);

  // Exercise set recorded
  assert.equal(draft.exercises.length, 1);
  assert.equal(draft.exercises[0].name, 'Приседания');
  assert.deepEqual(draft.exercises[0].sets, [{ weight: 100, reps: 8 }]);

  // Telegram callApi was invoked for editMessageWidgetData and answerWidgetQuery
  const editCall = apiCalls.find((c) => c.method === 'editMessageWidgetData');
  assert.ok(editCall, 'Must call editMessageWidgetData');
  assert.equal(editCall.data.message_id, 111);

  const answerCall = apiCalls.find((c) => c.method === 'answerWidgetQuery');
  assert.ok(answerCall, 'Must call answerWidgetQuery');
  assert.equal(answerCall.data.widget_query_id, 'query_123');
  assert.ok(answerCall.data.text.includes('100 кг × 8'));

  clearDraft(userId);
});

test('handleWidgetQuery: handles add_rest and skip_rest queries', async () => {
  const userId = 777004;
  const chatId = 888004;
  clearDraft(userId);
  const draft = startDraft(userId, chatId);
  draft.currentExerciseName = 'Бицепс';

  const apiCalls: { method: string; data: any }[] = [];
  const mockCtx: any = {
    telegram: {
      callApi: async (method: any, data: any) => {
        apiCalls.push({ method, data });
        return true;
      },
    },
  };

  // 1. add_rest
  await handleWidgetQuery(mockCtx, {
    id: 'q_add',
    from: { id: userId, first_name: 'User' },
    data: JSON.stringify({ action: 'add_rest', restAdded: 30 }),
  });

  const lastCall1 = apiCalls[apiCalls.length - 1];
  assert.equal(lastCall1.method, 'answerWidgetQuery');
  assert.ok(lastCall1.data.text.includes('+30 сек'));

  // 2. skip_rest
  await handleWidgetQuery(mockCtx, {
    id: 'q_skip',
    from: { id: userId, first_name: 'User' },
    message: { message_id: 222, chat: { id: chatId, type: 'private' } },
    data: JSON.stringify({ action: 'skip_rest' }),
  });

  const editCall = apiCalls.find((c) => c.method === 'editMessageWidgetData' && c.data.message_id === 222);
  assert.ok(editCall, 'Must update widget data on skip rest');

  clearDraft(userId);
});

test('handleWidgetQuery: next_exercise routes to exercise menu via sendMessage without throwing', async () => {
  const userId = 777005;
  const chatId = 888005;
  clearDraft(userId);
  const draft = startDraft(userId, chatId);
  draft.currentExerciseName = 'Приседания';
  draft.exercises.push({ name: 'Приседания', sets: [{ weight: 100, reps: 8 }], orderIndex: 0 });

  const sentMessages: { chatId: any; text: string; extra: any }[] = [];
  const apiCalls: { method: string; data: any }[] = [];
  const mockCtx: any = {
    telegram: {
      callApi: async (method: any, data: any) => {
        apiCalls.push({ method, data });
        return true;
      },
      sendMessage: async (targetChatId: any, text: string, extra: any) => {
        sentMessages.push({ chatId: targetChatId, text, extra });
        return { message_id: 999 };
      },
    },
  };

  await handleWidgetQuery(mockCtx, {
    id: 'q_next_ex',
    from: { id: userId, first_name: 'User' },
    message: { message_id: 333, chat: { id: chatId, type: 'private' } },
    data: JSON.stringify({ action: 'next_exercise' }),
  });

  assert.equal(draft.currentExerciseName, undefined);
  assert.equal(draft.step, 'choosing_exercise_name');
  assert.equal(sentMessages.length, 1);
  assert.ok(sentMessages[0].text.includes('упражнение'));

  clearDraft(userId);
});

test('handleWidgetQuery: finish_workout triggers workout save and sends summary via sendMessage', async () => {
  const userId = 777006;
  const chatId = 888006;
  clearDraft(userId);
  const draft = startDraft(userId, chatId);
  draft.type = 'strength';
  draft.exercises.push({ name: 'Жим лёжа', sets: [{ weight: 80, reps: 10 }], orderIndex: 0 });

  const sentMessages: { chatId: any; text: string; extra: any }[] = [];
  const apiCalls: { method: string; data: any }[] = [];
  const mockCtx: any = {
    telegram: {
      callApi: async (method: any, data: any) => {
        apiCalls.push({ method, data });
        return true;
      },
      sendMessage: async (targetChatId: any, text: string, extra: any) => {
        sentMessages.push({ chatId: targetChatId, text, extra });
        return { message_id: 999 };
      },
    },
  };

  await handleWidgetQuery(mockCtx, {
    id: 'q_finish',
    from: { id: userId, first_name: 'User' },
    message: { message_id: 444, chat: { id: chatId, type: 'private' } },
    data: JSON.stringify({ action: 'finish_workout' }),
  });

  assert.equal(sentMessages.length, 1);
  // Draft was saved and cleared
  assert.equal(getDraft(userId), undefined);

  clearDraft(userId);
});

test('handleWidgetQuery: handles finish_exercise and add_set actions', async () => {
  const userId = 777007;
  const chatId = 888007;
  clearDraft(userId);
  const draft = startDraft(userId, chatId);
  draft.currentExerciseName = 'Становая тяга';
  draft.exercises.push({ name: 'Становая тяга', sets: [{ weight: 120, reps: 5 }], orderIndex: 0 });

  const apiCalls: { method: string; data: any }[] = [];
  const mockCtx: any = {
    telegram: {
      callApi: async (method: any, data: any) => {
        apiCalls.push({ method, data });
        return true;
      },
    },
  };

  // 1. finish_exercise
  await handleWidgetQuery(mockCtx, {
    id: 'q_fin_ex',
    from: { id: userId, first_name: 'User' },
    message: { message_id: 555, chat: { id: chatId, type: 'private' } },
    data: JSON.stringify({ action: 'finish_exercise' }),
  });

  const editCall1 = apiCalls.find((c) => c.method === 'editMessageWidgetData');
  assert.ok(editCall1, 'Must update widget data on finish_exercise');

  // 2. add_set
  await handleWidgetQuery(mockCtx, {
    id: 'q_add_set',
    from: { id: userId, first_name: 'User' },
    message: { message_id: 555, chat: { id: chatId, type: 'private' } },
    data: JSON.stringify({ action: 'add_set' }),
  });

  const editCalls = apiCalls.filter((c) => c.method === 'editMessageWidgetData');
  assert.ok(editCalls.length >= 2, 'Must update widget data on add_set');

  clearDraft(userId);
});
