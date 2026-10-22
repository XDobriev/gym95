import { Telegraf } from 'telegraf';
import { config } from './config';
import { registerAccess } from './handlers/access';
import { registerOnboarding } from './handlers/onboarding';
import { registerStart } from './handlers/start';
import { registerToday } from './handlers/today';
import { registerHistory } from './handlers/history';
import { registerProgress } from './handlers/progress';
import { registerExport } from './handlers/export';
import { registerWorkout } from './handlers/workout';
import { registerWorkoutEdit } from './handlers/workout/editStep';
import { registerTemplateManagement } from './handlers/templates/manage';
import { registerSettings } from './handlers/settings';
import { registerWebApp } from './handlers/webapp';
import { registerMorning } from './handlers/morning';
import { registerBody } from './handlers/body';
import { registerFood } from './handlers/food';
import { registerWater } from './handlers/water';
import { registerMeasure } from './handlers/measure';
import { registerVoice } from './handlers/voice';
import { registerPlates } from './handlers/plates';
import { registerDiet } from './handlers/diet';
import { registerAchievements } from './handlers/achievements';
import { registerFreeze } from './handlers/freeze';
import { registerPrograms } from './handlers/programs';

export const bot = new Telegraf(config.BOT_TOKEN);

// Порядок важен: доступ — первым, затем знакомство (его текстовый обработчик
// должен видеть текст раньше остальных FSM).
registerAccess(bot);
registerOnboarding(bot);
registerStart(bot);
registerToday(bot);
registerPlates(bot);
registerDiet(bot);
registerAchievements(bot);
registerFreeze(bot);
registerPrograms(bot);
registerWorkout(bot);
registerWorkoutEdit(bot);
registerTemplateManagement(bot);
registerHistory(bot);
registerProgress(bot);
registerExport(bot);
registerSettings(bot);
registerWebApp(bot);
registerMorning(bot);
registerWater(bot);
registerMeasure(bot);
// Последним: текстовый обработчик веса/сна забирает текст, только если его не взял никто другой.
registerBody(bot);
// Самым последним: еда пишется свободным текстом («обед 650») и берёт всё, что осталось.
registerFood(bot);
registerVoice(bot);

const FAILURE_TEXT = '⚠️ Не получилось выполнить действие — сервис может быть временно недоступен. Попробуй через пару минут.';

bot.catch(async (err, ctx) => {
  // Повторное нажатие той же кнопки перерисовывает сообщение без изменений —
  // Telegram отвечает 400 «message is not modified». Это не сбой, молча игнорируем.
  if (err instanceof Error && err.message.includes('message is not modified')) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => undefined);
    return;
  }
  console.error(`Ошибка обработки апдейта ${ctx.updateType}:`, err);
  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Ошибка, попробуй позже');
    if (ctx.chat) await ctx.reply(FAILURE_TEXT);
  } catch {
    // Telegram тоже недоступен — остаётся только лог.
  }
});
