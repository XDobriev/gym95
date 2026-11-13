import test from 'node:test';
import assert from 'node:assert/strict';
import { sendWaterOutput } from './water';

test('sendWaterOutput: sends widget via sendWidget when API is available', async () => {
  let calledApiMethod = '';
  let calledApiData: any = null;

  const mockCtx: any = {
    chat: { id: 98765 },
    telegram: {
      callApi: async (method: string, data: any) => {
        calledApiMethod = method;
        calledApiData = data;
        return { message_id: 101 };
      },
    },
    reply: async () => {
      throw new Error('Should not call reply when sendWidget succeeds');
    },
  };

  await sendWaterOutput(mockCtx, 1);

  assert.equal(calledApiMethod, 'sendWidget');
  assert.equal(calledApiData.chat_id, 98765);
  assert.ok(calledApiData.html.includes('Трекер воды gym95'));
});

test('sendWaterOutput: gracefully falls back to sendWaterStatus when sendWidget fails', async () => {
  let replyCalled = false;
  let replyText = '';

  const mockCtx: any = {
    chat: { id: 98765 },
    telegram: {
      callApi: async () => {
        throw new Error('Bot API 10.4 sendWidget not supported by client');
      },
    },
    reply: async (text: string) => {
      replyCalled = true;
      replyText = text;
    },
  };

  await sendWaterOutput(mockCtx, 1);

  assert.equal(replyCalled, true);
  assert.ok(replyText.includes('Вода:'));
});
