import cron, { ScheduledTask } from 'node-cron';
import { Telegraf } from 'telegraf';
import { getAllProfileTimezones } from '../db/profiles';
import { getModuleRowsForAll, upsertModules } from '../db/modules';
import { getWaterStatus, waterSettingsOf, waterStatusText } from '../modules/water';
import { localNow } from '../utils/time';
import { waterReminderDue } from '../utils/water';
import { waterKeyboard } from '../handlers/water';

// Напоминания о воде во времена пользователя (по умолчанию 10/13/16/19 по его поясу),
// если модуль включён и норма ещё не набрана.
let task: ScheduledTask | null = null;
const sentWaterSlots = new Set<string>(); // key: `${userId}:${dateStr}:${hhmm}`

export function startWaterCron(bot: Telegraf): void {
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
      const [profiles, waterRows] = await Promise.all([getAllProfileTimezones(), getModuleRowsForAll('water')]);
      for (const p of profiles) {
        const row = waterRows.find((r) => r.user_id === p.user_id);
        if (!row?.enabled) continue;
        const { times } = waterSettingsOf(row);
        const { hhmm, dateStr } = localNow(p.timezone, now);
        if (!times.includes(hhmm)) continue;

        const slotKey = `${dateStr}:${hhmm}`;
        const userSlotKey = `${p.user_id}:${slotKey}`;
        const lastSlot = (row.settings as { lastReminderSlot?: string } | undefined)?.lastReminderSlot;

        // Двойная защита: персистентная в БД (между рестартами процесса) и in-memory lock
        if (lastSlot === slotKey || sentWaterSlots.has(userSlotKey)) continue;
        sentWaterSlots.add(userSlotKey);

        try {
          const status = await getWaterStatus(p.user_id, p.timezone, dateStr);
          if (!waterReminderDue(hhmm, status.drunkMl, status.targetMl, times)) continue;

          // Фиксируем отправку в БД до/во время отправки сообщения
          row.settings = { ...(row.settings ?? {}), lastReminderSlot: slotKey };
          await upsertModules([
            {
              user_id: p.user_id,
              module: 'water',
              enabled: row.enabled,
              settings: row.settings,
            },
          ]);

          await bot.telegram.sendMessage(p.user_id, `Время попить воды 💧\n\n${waterStatusText(status)}`, {
            reply_markup: waterKeyboard(),
          });
        } catch (err) {
          console.error(`Не удалось отправить напоминание о воде userId=${p.user_id}:`, err);
        }
      }
      if (sentWaterSlots.size > 1000) {
        sentWaterSlots.clear();
      }
    } catch (err) {
      console.error('Ошибка в water cron job:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('Water cron job запущен (времена пользователя, по умолчанию 10/13/16/19)');
}

export function stopWaterCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
