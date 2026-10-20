import { getModules, UserModuleRow } from '../db/modules';
import { getAllWorkoutDates } from '../db/workouts';
import { getUserTimezone } from '../db/profiles';
import { computeChain } from '../utils/chain';
import { localNow } from '../utils/time';
import { pluralizeRu } from '../utils/format';

export const DEFAULT_CHAIN_GOAL = 20;
export const DEFAULT_MAX_GAP_DAYS = 2;

export interface ChainInfo {
  current: number;
  best: number;
  deadline: string | null;
  goal: number;
  maxGapDays: number;
}

export function chainSettingsOf(row: UserModuleRow | undefined): { goal: number; maxGapDays: number } {
  const goal = Number(row?.settings.chainGoal ?? DEFAULT_CHAIN_GOAL);
  const maxGapDays = Number(row?.settings.maxGapDays ?? DEFAULT_MAX_GAP_DAYS);
  return {
    goal: Number.isInteger(goal) && goal > 0 ? goal : DEFAULT_CHAIN_GOAL,
    maxGapDays: [1, 2, 3].includes(maxGapDays) ? maxGapDays : DEFAULT_MAX_GAP_DAYS,
  };
}

// null — модуль активности выключен у пользователя.
export async function getChainInfo(userId: number): Promise<ChainInfo | null> {
  const row = (await getModules(userId)).find((r) => r.module === 'activity');
  if (row && !row.enabled) return null;
  const { goal, maxGapDays } = chainSettingsOf(row);

  const tz = await getUserTimezone(userId);
  const dates = (await getAllWorkoutDates(userId)).map((d) => localNow(tz, new Date(d)).dateStr);
  const status = computeChain(dates, localNow(tz).dateStr, maxGapDays);
  return { ...status, goal, maxGapDays };
}

function formatDayMonth(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export function chainLines(c: ChainInfo): string {
  const lines = [`🔗 Цепочка: ${c.current} / ${c.goal}${c.best > c.current ? ` · рекорд ${c.best}` : ''}`];
  if (c.current === 0) {
    lines.push('   Начни сегодня — любая тренировка засчитывается');
  } else if (c.deadline) {
    lines.push(`   Следующая тренировка — до ${formatDayMonth(c.deadline)} включительно`);
  }
  return lines.join('\n');
}

// Строка для сообщения «Тренировка сохранена». Поздравление — ровно в день достижения цели.
export function chainAfterSaveText(c: ChainInfo): string {
  const left = c.goal - c.current;
  if (left === 0) {
    return `🔗 Цепочка: ${c.current} / ${c.goal}\n🎉 Цель цепочки достигнута! Новую цель можно поставить в /settings → Тренировки → Цепочка.`;
  }
  if (left > 0) {
    const word = pluralizeRu(left, ['тренировка', 'тренировки', 'тренировок']);
    return `🔗 Цепочка: ${c.current} / ${c.goal} — осталось ${left} ${word}`;
  }
  return `🔗 Цепочка: ${c.current} (цель ${c.goal} уже позади 💪)`;
}

export async function activityTodaySection(userId: number): Promise<string | null> {
  const info = await getChainInfo(userId);
  return info ? chainLines(info) : null;
}
