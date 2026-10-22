import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainMenuReplyKeyboard } from './mainMenu';

test('mainMenuReplyKeyboard: содержит 9 основных быстрых кнопок в 3 ряда', () => {
  const kb = mainMenuReplyKeyboard().reply_markup;
  assert.equal(kb.keyboard.length, 3);
  assert.deepEqual(kb.keyboard[0], ['🏋️ Тренировка', '💧 Вода', '🥗 Еда']);
  assert.deepEqual(kb.keyboard[1], ['⚖️ Вес', '🧮 Блины', '📖 Дневник']);
  assert.deepEqual(kb.keyboard[2], ['🎯 Сегодня', '🏆 Достижения', '⚙️ Настройки']);
  assert.equal(kb.resize_keyboard, true);
});
