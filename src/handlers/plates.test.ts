import test from 'node:test';
import assert from 'node:assert/strict';
import { sendPlatesOutput } from './plates';

test('sendPlatesOutput: sends widget via sendWidget when API is available', async () => {
  let calledApiMethod = '';
  let calledApiData: any = null;

  const mockCtx: any = {
    chat: { id: 12345 },
    telegram: {
      callApi: async (method: string, data: any) => {
        calledApiMethod = method;
        calledApiData = data;
        return { message_id: 99 };
      },
    },
    reply: async () => {
      throw new Error('Should not call reply when sendWidget succeeds');
    },
  };

  await sendPlatesOutput(mockCtx, 100, 20);

  assert.equal(calledApiMethod, 'sendWidget');
  assert.equal(calledApiData.chat_id, 12345);
  assert.ok(calledApiData.html.includes('Калькулятор блинов gym95'));
});

test('sendPlatesOutput: gracefully falls back to reply when sendWidget fails', async () => {
  let replyCalled = false;
  let replyText = '';

  const mockCtx: any = {
    chat: { id: 12345 },
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

  await sendPlatesOutput(mockCtx, 100, 20);

  assert.equal(replyCalled, true);
  assert.ok(replyText.includes('Штанга: 100 кг'));
});
