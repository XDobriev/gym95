import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { getAllProfileTimezones } from '../db/profiles';
import { getSettingsForUsers, upsertSettings } from '../db/settings';
import { localNow } from '../utils/time';
import { startMorning } from '../handlers/morning';

// Каждую минуту: у кого по его местному времени наступило morning_time и обзор
// сегодня ещё не отправлялся — шлём утренний обзор («вчера» → сон → вес).
export function startMorningCron(bot: Telegraf): void {
  let isRunning = false;

  cron.schedule('* * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const profiles = await getAllProfileTimezones();
      if (profiles.length === 0) return;
      const settings = await getSettingsForUsers(profiles.map((p) => p.user_id));
      const now = new Date();

      for (const p of profiles) {
        const s = settings.get(p.user_id)!;
        if (!s.morning_enabled) continue;
        const { hhmm, dateStr } = localNow(p.timezone, now);
        if (s.morning_time !== hhmm || s.last_morning_date === dateStr) continue;
        try {
          // Сначала отмечаем отправку: если сообщение упадёт посередине, не будем слать повторно каждую минуту.
          await upsertSettings(p.user_id, { last_morning_date: dateStr });
          await startMorning((text, extra) => bot.telegram.sendMessage(p.user_id, text, extra), p.user_id);
        } catch (err) {
          console.error(`Не удалось отправить утренний обзор userId=${p.user_id}:`, err);
        }
      }
    } catch (err) {
      console.error('Ошибка в morning cron job:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('Morning cron job запущен (утренний обзор по поясу каждого пользователя)');
}
