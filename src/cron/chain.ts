import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { getAllProfileTimezones } from '../db/profiles';
import { getModuleRowsForAll } from '../db/modules';
import { getChainInfo } from '../modules/activity';
import { localNow } from '../utils/time';

export const CHAIN_REMINDER_TIME = '20:00';

// В 20:00 по поясу пользователя: если сегодня последний день, когда тренировка
// продлит цепочку, — напомнить. Тем, кто уже тренировался сегодня, дедлайн позже.
export function startChainCron(bot: Telegraf): void {
  let isRunning = false;

  cron.schedule('* * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const now = new Date();
      const profiles = (await getAllProfileTimezones()).filter((p) => localNow(p.timezone, now).hhmm === CHAIN_REMINDER_TIME);
      if (profiles.length === 0) return;
      const rows = await getModuleRowsForAll('activity');
      for (const p of profiles) {
        if (rows.some((r) => r.user_id === p.user_id && !r.enabled)) continue;
        try {
          const info = await getChainInfo(p.user_id);
          if (!info || info.current === 0 || info.deadline !== localNow(p.timezone, now).dateStr) continue;
          await bot.telegram.sendMessage(
            p.user_id,
            `🔗 Сегодня последний день сохранить цепочку ${info.current} / ${info.goal}!\n` +
              'Подойдёт любая тренировка — хоть короткий «Дом» на 10 минут: /new_workout'
          );
        } catch (err) {
          console.error(`Не удалось отправить напоминание о цепочке userId=${p.user_id}:`, err);
        }
      }
    } catch (err) {
      console.error('Ошибка в chain cron job:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log(`Chain cron job запущен (${CHAIN_REMINDER_TIME} по поясу пользователя)`);
}
