import cron, { ScheduledTask } from 'node-cron';
import { Telegraf } from 'telegraf';
import { getAllProfileTimezones } from '../db/profiles';
import { getSettingsForUsers, upsertSettings } from '../db/settings';
import { localNow } from '../utils/time';
import { startMorning } from '../handlers/morning';

let task: ScheduledTask | null = null;
const sendingMorning = new Set<string>(); // key: `${userId}:${dateStr}`

// Каждую минуту: у кого по его местному времени наступило morning_time и обзор
// сегодня ещё не отправлялся — шлём утренний обзор («вчера» → сон → вес).
export function startMorningCron(bot: Telegraf): void {
  if (task) {
    task.stop();
    task = null;
  }

  let isRunning = false;

  task = cron.schedule('* * * * *', async () => {
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
        const morningKey = `${p.user_id}:${dateStr}`;
        if (s.morning_time !== hhmm || s.last_morning_date === dateStr || sendingMorning.has(morningKey)) continue;
        sendingMorning.add(morningKey);
        try {
          // Сначала отмечаем отправку: если сообщение упадёт посередине, не будем слать повторно каждую минуту.
          await upsertSettings(p.user_id, { last_morning_date: dateStr });
          await startMorning((text, extra) => bot.telegram.sendMessage(p.user_id, text, extra), p.user_id);
        } catch (err) {
          sendingMorning.delete(morningKey);
          console.error(`Не удалось отправить утренний обзор userId=${p.user_id}:`, err);
        }
      }
      if (sendingMorning.size > 1000) {
        sendingMorning.clear();
      }
    } catch (err) {
      console.error('Ошибка в morning cron job:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('Morning cron job запущен (утренний обзор по поясу каждого пользователя)');
}

export function stopMorningCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
