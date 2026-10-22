import cron, { ScheduledTask } from 'node-cron';
import { Telegraf } from 'telegraf';
import { getEnabledReminderSettings, upsertSettings } from '../db/settings';
import { getRecentWorkouts } from '../db/workouts';
import { getTimezones } from '../db/profiles';
import { DEFAULT_TZ, localNow } from '../utils/time';

const MIN_DAYS_SINCE_LAST_WORKOUT = 2;
const REMINDER_TEXT =
  'Уже пара дней без тренировки — самое время вернуться 💪\nЗапиши тренировку: /new_workout';

async function daysSinceLastWorkout(userId: number): Promise<number> {
  const [last] = await getRecentWorkouts(userId, 1, 0);
  if (!last) return Infinity;
  return (Date.now() - new Date(last.date).getTime()) / 86_400_000;
}

let task: ScheduledTask | null = null;
const sendingReminders = new Set<string>(); // key: `${userId}:${dateStr}`

// Каждую реальную минуту: для каждого пользователя с включёнными напоминаниями
// сравниваем ЕГО местное время с reminder_time (пояс — из profiles.timezone).
export function startReminderCron(bot: Telegraf): void {
  if (task) {
    task.stop();
    task = null;
  }

  let isRunning = false;

  task = cron.schedule('* * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const rows = await getEnabledReminderSettings();
      if (rows.length === 0) return;
      const tzMap = await getTimezones(rows.map((r) => r.user_id));
      const now = new Date();

      for (const row of rows) {
        const { hhmm, dateStr } = localNow(tzMap.get(row.user_id) ?? DEFAULT_TZ, now);
        const reminderKey = `${row.user_id}:${dateStr}`;
        if (row.reminder_time !== hhmm || row.last_reminder_sent_date === dateStr || sendingReminders.has(reminderKey)) continue;
        sendingReminders.add(reminderKey);
        try {
          if ((await daysSinceLastWorkout(row.user_id)) < MIN_DAYS_SINCE_LAST_WORKOUT) continue;
          await bot.telegram.sendMessage(row.user_id, REMINDER_TEXT);
          await upsertSettings(row.user_id, { last_reminder_sent_date: dateStr });
        } catch (err) {
          sendingReminders.delete(reminderKey);
          console.error(`Не удалось отправить напоминание userId=${row.user_id}:`, err);
        }
      }
      if (sendingReminders.size > 1000) {
        sendingReminders.clear();
      }
    } catch (err) {
      console.error('Ошибка в reminder cron job:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('Reminder cron job запущен (пояс каждого пользователя, проверка каждую минуту)');
}

export function stopReminderCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
