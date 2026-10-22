import { Markup, Telegraf } from 'telegraf';
import { createWorkout, getAllWorkoutDates } from '../db/workouts';
import { getUserTimezone } from '../db/profiles';
import { localNow, addDays, localNoonUtc } from '../utils/time';
import { computeChain } from '../utils/chain';

export function registerFreeze(bot: Telegraf): void {
  bot.command(['freeze', 'shield'], async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const tz = await getUserTimezone(userId);
    const today = localNow(tz).dateStr;
    const yesterday = addDays(today, -1);

    const dates = (await getAllWorkoutDates(userId).catch(() => [])).map((d: string) => d.slice(0, 10));
    const chain = computeChain(dates, today, 2);

    await ctx.reply(
      `❄️ *Защита и заморозка стрика*\n\nЕсли ты заболел, восстанавливаешься или в поездке, используй заморозку дня, чтобы стрик не прервался.\n\nТекущая цепочка: *${chain.current} дн* (рекорд: *${chain.best} дн*).\n\nКакой день защитить?`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(`❄️ Заморозить сегодня (${today.slice(5)})`, `frz:${today}`)],
          [Markup.button.callback(`❄️ Заморозить вчера (${yesterday.slice(5)})`, `frz:${yesterday}`)],
        ]).reply_markup,
      }
    );
  });

  bot.action(/^frz:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const targetDateStr = ctx.match[1];
    const tz = await getUserTimezone(userId);
    const targetDate = localNoonUtc(targetDateStr, tz);

    // Проверяем, нет ли уже тренировки или заморозки за этот день
    const dates = (await getAllWorkoutDates(userId).catch(() => [])).map((d: string) => d.slice(0, 10));
    const existing = dates.includes(targetDateStr);

    if (existing) {
      await ctx.reply(`За дату ${targetDateStr} уже есть запись (тренировка или заморозка). Стрик уже защищен!`);
      return;
    }

    await createWorkout({
      userId,
      type: 'mixed',
      date: targetDate,
      durationMinutes: 0,
      notes: '❄️ Заморозка стрика (отдых / восстановление)',
    });

    const updatedDates = (await getAllWorkoutDates(userId).catch(() => [])).map((d: string) => d.slice(0, 10));
    const today = localNow(tz).dateStr;
    const updatedChain = computeChain(updatedDates, today, 2);

    await ctx.reply(
      `🛡 *Стрик успешно защищен!*\n\nДата *${targetDateStr}* зафиксирована как день восстановления.\nТвоя цепочка сохранена: *${updatedChain.current} дней подряд* 🔥`,
      { parse_mode: 'Markdown' }
    );
  });
}
