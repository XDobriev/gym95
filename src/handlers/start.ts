import { Telegraf } from 'telegraf';
import { sendToday } from './today';
import { mainMenuReplyKeyboard } from './mainMenu';

const HELP_TEXT = `Команды:
/today — сегодня: что сделано и что осталось
/morning — утренний обзор: вчера → сон → вес (приходит сам в 07:30)
/weight 130.4 — записать вес (за другой день: /weight 131.2 09.10)
/sleep 7.5 — записать сон (за другую ночь: /sleep 7.5 09.10)
/body — вес и сон: сводка и график
/food — еда за сегодня, средние ккал, частые блюда
/water — вода за сегодня (норма и время напоминаний — в /settings → 💧 Вода)
/measure — замеры лентой (за другой день: /measure 09.10)
Еду можно писать просто текстом: «обед 650», «перекус 2 яблока 190», «вчера ужин 700».
Не знаешь калорийность — напиши без числа («обед гречка с курицей»), бот оценит сам
/new_workout — начать новую тренировку
/done — завершить и сохранить текущую тренировку
/calc 85 — раскладка блинов на штангу и схема разминки
/diet — план питания, БЖУ и список продуктов на неделю
/programs — готовые программы (похудение, верх/низ, воркаут)
/achievements — витрина спортивных достижений и рекордов
/freeze — заморозка стрика (защита цепочки при отдыхе/болезни)
/templates — шаблоны тренировок (фулбади, дом, стадион, свои)
/history — последние тренировки
/progress <упражнение> — история весов/повторений по упражнению
/export — вся история в markdown (удобно вставить в чат с LLM)
/settings — профиль, напоминания, цель недели
/app — открыть дневник (Mini App)`;

// Сюда доходят только пользователи с профилем: остальных перехватывает
// middleware доступа (src/handlers/access.ts) и знакомство.
export function registerStart(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    await ctx.reply('👋 Главное меню быстрого доступа всегда под рукой внизу чата 👇', {
      reply_markup: mainMenuReplyKeyboard().reply_markup,
    });
    await sendToday(ctx, ctx.from.id);
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(HELP_TEXT, {
      reply_markup: mainMenuReplyKeyboard().reply_markup,
    });
  });
}
