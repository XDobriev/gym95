import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sendWidget,
  editMessageWidgetData,
  answerWidgetQuery,
  serializeWidgetData,
  deserializeWidgetData,
  validateWidgetDataSize,
  parseWidgetQueryPayload,
  calculateCompletedTonnage,
  LiveWorkoutWidgetState,
  MAX_CHAT_DATA_BYTES,
  MAX_WIDGET_HTML_BYTES,
} from './telegramWidgets';

test('validateWidgetDataSize: accurately checks byte length under 1024 bytes', () => {
  const shortString = JSON.stringify({ wid: '123', w: 80, r: 10 });
  assert.equal(validateWidgetDataSize(shortString), true);

  const oversizedString = 'x'.repeat(MAX_CHAT_DATA_BYTES + 1);
  assert.equal(validateWidgetDataSize(oversizedString), false);
});

test('serializeWidgetData & deserializeWidgetData: roundtrip state serialization', () => {
  const state: LiveWorkoutWidgetState = {
    wid: 'workout_42',
    ex: 'Приседания со штангой',
    sn: 2,
    st: 4,
    w: 120.5,
    r: 6,
    pw: 117.5,
    pr: 6,
    m: 'active',
    rd: 120,
    completedSets: [{ w: 117.5, r: 6 }],
  };

  const serialized = serializeWidgetData(state);
  assert.ok(Buffer.byteLength(serialized, 'utf8') <= MAX_CHAT_DATA_BYTES);

  const restored = deserializeWidgetData(serialized);
  assert.equal(restored.wid, 'workout_42');
  assert.equal(restored.ex, 'Приседания со штангой');
  assert.equal(restored.sn, 2);
  assert.equal(restored.st, 4);
  assert.equal(restored.w, 120.5);
  assert.equal(restored.r, 6);
  assert.equal(restored.pw, 117.5);
  assert.equal(restored.pr, 6);
  assert.equal(restored.m, 'active');
  assert.equal(restored.rd, 120);
  assert.deepEqual(restored.completedSets, [{ w: 117.5, r: 6 }]);
});

test('serializeWidgetData: handles large sets list without exceeding byte limit', () => {
  const manySets = Array.from({ length: 30 }, (_, i) => ({ w: 100 + i, r: 8 }));
  const state: LiveWorkoutWidgetState = {
    wid: 'w_test_heavy',
    ex: 'Становая тяга',
    sn: 31,
    st: 30,
    w: 140,
    r: 5,
    m: 'done',
    completedSets: manySets,
  };

  const serialized = serializeWidgetData(state);
  assert.ok(Buffer.byteLength(serialized, 'utf8') <= MAX_CHAT_DATA_BYTES);
});

test('deserializeWidgetData: handles invalid input safely', () => {
  assert.throws(() => deserializeWidgetData('invalid json{'), /Failed to parse widget chat_data/);
});

test('parseWidgetQueryPayload: correctly parses client payload', () => {
  const parsed1 = parseWidgetQueryPayload('{"action":"finish_set","weight":92.5,"reps":8,"setIndex":3}');
  assert.equal(parsed1.action, 'finish_set');
  assert.equal(parsed1.weight, 92.5);
  assert.equal(parsed1.reps, 8);
  assert.equal(parsed1.setIndex, 3);

  const parsed2 = parseWidgetQueryPayload(undefined);
  assert.equal(parsed2.action, 'finish_set');

  const parsed3 = parseWidgetQueryPayload('{"action":"add_rest","restAdded":30}');
  assert.equal(parsed3.action, 'add_rest');
  assert.equal(parsed3.restAdded, 30);
});

test('calculateCompletedTonnage: computes total volume correctly', () => {
  const sets = [
    { w: 100, r: 10 }, // 1000
    { w: 105, r: 8 },  // 840
    { w: 110, r: 6 },  // 660
  ];
  assert.equal(calculateCompletedTonnage(sets), 2500);
  assert.equal(calculateCompletedTonnage([]), 0);
});

test('sendWidget: calls callApi with expected method and payload', async () => {
  const calls: { method: string; data: any }[] = [];
  const mockTelegram = {
    callApi: async (method: any, data: any) => {
      calls.push({ method, data });
      return { message_id: 999 };
    },
  };

  const html = '<div>test</div>';
  const chat_data = JSON.stringify({ wid: '1' });
  const res = await sendWidget(mockTelegram, {
    chat_id: 12345,
    html,
    chat_data,
  });

  assert.equal(res.message_id, 999);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'sendWidget');
  assert.equal(calls[0].data.chat_id, 12345);
  assert.equal(calls[0].data.html, html);
  assert.equal(calls[0].data.chat_data, chat_data);
});

test('sendWidget: throws error if HTML exceeds 32 KB', async () => {
  const mockTelegram = {
    callApi: async () => ({ ok: true }),
  };

  const giantHtml = 'x'.repeat(MAX_WIDGET_HTML_BYTES + 10);
  await assert.rejects(
    () => sendWidget(mockTelegram, { chat_id: 1, html: giantHtml }),
    /Widget HTML exceeds 32 KB limit/
  );
});

test('editMessageWidgetData & answerWidgetQuery: callApi invocation', async () => {
  const calls: { method: string; data: any }[] = [];
  const mockTelegram = {
    callApi: async (method: any, data: any) => {
      calls.push({ method, data });
      return true;
    },
  };

  await editMessageWidgetData(mockTelegram, {
    chat_id: 123,
    message_id: 456,
    chat_data: '{"m":"resting"}',
  });

  assert.equal(calls[0].method, 'editMessageWidgetData');
  assert.equal(calls[0].data.message_id, 456);

  await answerWidgetQuery(mockTelegram, {
    widget_query_id: 'wq_test',
    text: 'Готово!',
    show_alert: false,
  });

  assert.equal(calls[1].method, 'answerWidgetQuery');
  assert.equal(calls[1].data.widget_query_id, 'wq_test');
});
