import cron, { ScheduledTask } from 'node-cron';
import { Telegraf } from 'telegraf';
import { getAllProfileTimezones } from '../db/profiles';
import { getModuleRowsForAll, upsertModules } from '../db/modules';
import { getChainInfo } from '../modules/activity';
import { localNow } from '../utils/time';

export const CHAIN_REMINDER_TIME = '20:00';

let task: ScheduledTask | null = null;
const sentChainSlots = new Set<string>(); // key: `${userId}:${dateStr}`

// В 20:00 по поясу пользователя: если сегодня последний день, когда тренировка
// продлит цепочку, — напомнить. Тем, кто уже тренировался сегодня, дедлайн позже.
export function startChainCron(bot: Telegraf): void {
  if (task) {
    task.stop();
    task = null;
  }

  let isRunning = false;

  task = cron.schedule('* * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const now = new Date();
      const profiles = (await getAllProfileTimezones()).filter((p) => localNow(p.timezone, now).hhmm === CHAIN_REMINDER_TIME);
      if (profiles.length === 0) return;
      const rows = await getModuleRowsForAll('activity');
      for (const p of profiles) {
        const row = rows.find((r) => r.user_id === p.user_id);
        if (row && !row.enabled) continue;
        const { dateStr } = localNow(p.timezone, now);
        const chainKey = `${p.user_id}:${dateStr}`;
        const lastDate = (row?.settings as { lastReminderDate?: string } | undefined)?.lastReminderDate;

        if (lastDate === dateStr || sentChainSlots.has(chainKey)) continue;
        sentChainSlots.add(chainKey);

        try {
          const info = await getChainInfo(p.user_id);
          if (!info || info.current === 0 || info.deadline !== dateStr) continue;

          if (row) {
            row.settings = { ...(row.settings ?? {}), lastReminderDate: dateStr };
            await upsertModules([
              {
                user_id: p.user_id,
                module: 'activity',
                enabled: row.enabled,
                settings: row.settings,
              },
            ]);
          }

          await bot.telegram.sendMessage(
            p.user_id,
            `🔗 Сегодня последний день сохранить цепочку ${info.current} / ${info.goal}!\n` +
              'Подойдёт любая тренировка — хоть короткий «Дом» на 10 минут: /new_workout'
          );
        } catch (err) {
          console.error(`Не удалось отправить напоминание о цепочке userId=${p.user_id}:`, err);
        }
      }
      if (sentChainSlots.size > 1000) {
        sentChainSlots.clear();
      }
    } catch (err) {
      console.error('Ошибка в chain cron job:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log(`Chain cron job запущен (${CHAIN_REMINDER_TIME} по поясу пользователя)`);
}

export function stopChainCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
