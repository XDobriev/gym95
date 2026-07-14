import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { getUsersNeedingReminder, upsertSettings } from '../db/settings';

const MOSCOW_TZ = 'Europe/Moscow';
const MIN_DAYS_SINCE_LAST_WORKOUT = 2;
const REMINDER_TEXT =
  'Уже пара дней без тренировки — самое время вернуться в зал 💪\nЗапиши тренировку: /new_workout';

function getMoscowNow(): { hhmm: string; dateStr: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { hhmm: `${get('hour')}:${get('minute')}`, dateStr: `${get('year')}-${get('month')}-${get('day')}` };
}

export function startReminderCron(bot: Telegraf): void {
  let isRunning = false; // защита от наложения выполнений, если предыдущий тик ещё не завершился

  cron.schedule(
    '* * * * *',
    async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        const { hhmm, dateStr } = getMoscowNow();
        const userIds = await getUsersNeedingReminder(hhmm, dateStr, MIN_DAYS_SINCE_LAST_WORKOUT);

        for (const userId of userIds) {
          try {
            await bot.telegram.sendMessage(userId, REMINDER_TEXT);
            await upsertSettings(userId, { last_reminder_sent_date: dateStr });
          } catch (err) {
            console.error(`Не удалось отправить напоминание userId=${userId}:`, err);
          }
        }
      } catch (err) {
        console.error('Ошибка в reminder cron job:', err);
      } finally {
        isRunning = false;
      }
    },
    // options.timezone влияет на трактовку cron-выражения, а не на бизнес-логику:
    // при '* * * * *' джоба тикает каждую реальную минуту независимо от TZ.
    // Сравнение с пользовательским временем суток делается внутри callback через
    // Intl.DateTimeFormat, т.к. хост-время на Render — UTC.
    { timezone: MOSCOW_TZ }
  );

  console.log('Reminder cron job запущен (Europe/Moscow, проверка каждую минуту)');
}
