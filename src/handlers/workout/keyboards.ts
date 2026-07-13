import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

export function typeKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🏋️ Силовая', 'w:type:strength'),
      Markup.button.callback('🏃 Кардио', 'w:type:cardio'),
    ],
    [
      Markup.button.callback('🏊 Бассейн', 'w:type:pool'),
      Markup.button.callback('🔀 Смешанная', 'w:type:mixed'),
    ],
  ]).reply_markup;
}

export function exerciseNameKeyboard(recentNames: string[]): InlineKeyboardMarkup {
  const nameButtons = recentNames
    .slice(0, 6)
    .map((name, index) => Markup.button.callback(name, `w:ex:${index}`));

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < nameButtons.length; i += 2) {
    rows.push(nameButtons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback('✏️ Ввести своё название', 'w:ex:custom')]);
  rows.push([Markup.button.callback('✅ Завершить тренировку', 'w:finish')]);

  return Markup.inlineKeyboard(rows).reply_markup;
}

export function enteringSetsKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Отмена упражнения', 'w:cancel_exercise')],
  ]).reply_markup;
}

export function exerciseSavedMenuKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Ещё подход', 'w:add_more_sets')],
    [Markup.button.callback('🔁 Повторить последний подход', 'w:repeat_last')],
    [Markup.button.callback('➡️ Следующее упражнение', 'w:next_exercise')],
    [Markup.button.callback('✅ Завершить тренировку', 'w:finish')],
  ]).reply_markup;
}

export function resumeOrRestartKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('▶️ Продолжить', 'w:resume'),
      Markup.button.callback('🔄 Начать заново', 'w:restart'),
    ],
  ]).reply_markup;
}
