import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { getAllProfileTimezones } from '../db/profiles';
import { getModules } from '../db/modules';
import { getWaterStatus, waterStatusText } from '../modules/water';
import { localNow } from '../utils/time';
import { WATER_REMINDER_TIMES, waterReminderDue } from '../utils/water';
import { waterKeyboard } from '../handlers/water';

// В 10:00/13:00/16:00/19:00 по поясу пользователя — напоминание о воде, если модуль
// включён и норма ещё не набрана.
export function startWaterCron(bot: Telegraf): void {
  let isRunning = false;

  cron.schedule('* * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const now = new Date();
      const candidates = (await getAllProfileTimezones()).filter((p) =>
        WATER_REMINDER_TIMES.includes(localNow(p.timezone, now).hhmm)
      );
      for (const p of candidates) {
        try {
          const enabled = (await getModules(p.user_id)).some((r) => r.module === 'water' && r.enabled);
          if (!enabled) continue;
          const { hhmm, dateStr } = localNow(p.timezone, now);
          const status = await getWaterStatus(p.user_id, p.timezone, dateStr);
          if (!waterReminderDue(hhmm, status.drunkMl, status.targetMl)) continue;
          await bot.telegram.sendMessage(p.user_id, `Время попить воды 💧\n\n${waterStatusText(status)}`, {
            reply_markup: waterKeyboard(),
          });
        } catch (err) {
          console.error(`Не удалось отправить напоминание о воде userId=${p.user_id}:`, err);
        }
      }
    } catch (err) {
      console.error('Ошибка в water cron job:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('Water cron job запущен (10:00/13:00/16:00/19:00 по поясу пользователя)');
}
