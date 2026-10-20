import { Context, Markup, Telegraf } from 'telegraf';
import { getModules, patchModuleSettings } from '../db/modules';
import { chainSettingsOf } from '../modules/activity';
import { pluralizeRu } from '../utils/format';
import { otherActiveFlow, activeFlowBlockedMessage } from './activeFlow';
import { clearAwaitingSettingsInput, isWaitingForChainGoal, setWaitingForChainGoal } from './settingsState';

const CHAIN_GOAL_MAX = 365;

async function chainText(userId: number): Promise<{ text: string; gap: number }> {
  const row = (await getModules(userId)).find((r) => r.module === 'activity');
  const { goal, maxGapDays } = chainSettingsOf(row);
  const goalWord = pluralizeRu(goal, ['тренировка', 'тренировки', 'тренировок']);
  const gapWord = pluralizeRu(maxGapDays, ['дня', 'дней', 'дней']);
  return {
    text:
      `🔗 Цепочка\n\nЦель: ${goal} ${goalWord} подряд\nДопустимый перерыв: до ${maxGapDays} ${gapWord} отдыха\n\n` +
      'Засчитывается любая тренировка: зал, дом, стадион.',
    gap: maxGapDays,
  };
}

function chainKeyboard(gap: number) {
  const gapBtn = (n: number) => Markup.button.callback(`${n === gap ? '✅ ' : ''}${n} дн.`, `s:chain:gap:${n}`);
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎯 Изменить цель', 's:chain:goal')],
    [gapBtn(1), gapBtn(2), gapBtn(3)],
    [Markup.button.callback('⬅️ Назад', 's:workouts')],
  ]).reply_markup;
}

async function showChain(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const { text, gap } = await chainText(userId);
  if (viaEdit) await ctx.editMessageText(text, { reply_markup: chainKeyboard(gap) });
  else await ctx.reply(text, { reply_markup: chainKeyboard(gap) });
}

export function registerSettingsChain(bot: Telegraf): void {
  bot.action('s:chain', async (ctx) => {
    await ctx.answerCbQuery();
    await showChain(ctx, ctx.from.id, true);
  });

  bot.action(/^s:chain:gap:([1-3])$/, async (ctx) => {
    await ctx.answerCbQuery('Сохранено');
    await patchModuleSettings(ctx.from.id, 'activity', { maxGapDays: Number(ctx.match[1]) });
    await showChain(ctx, ctx.from.id, true);
  });

  bot.action('s:chain:goal', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const conflict = otherActiveFlow(userId, 'settings');
    if (conflict) {
      await ctx.reply(activeFlowBlockedMessage(conflict));
      return;
    }
    setWaitingForChainGoal(userId);
    await ctx.reply(`Сколько тренировок подряд — цель? Число от 2 до ${CHAIN_GOAL_MAX}, например 20.`);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    if (!isWaitingForChainGoal(userId)) return next();

    const n = Number(ctx.message.text.trim());
    if (!Number.isInteger(n) || n < 2 || n > CHAIN_GOAL_MAX) {
      await ctx.reply(`Нужно целое число от 2 до ${CHAIN_GOAL_MAX}, например 20.`);
      return;
    }
    clearAwaitingSettingsInput(userId);
    await patchModuleSettings(userId, 'activity', { chainGoal: n });
    await ctx.reply(`✅ Цель цепочки: ${n}.`);
    await showChain(ctx, userId, false);
  });
}
