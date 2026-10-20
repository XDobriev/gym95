import { Goal } from '../types/profile';
import { ModuleId, UserModuleRow } from '../db/modules';

export interface TodayContext {
  tz: string;
  todayStr: string;
}

export interface ModuleDef {
  id: ModuleId;
  title: string;
  available: boolean; // false — модуль ещё не реализован: нигде не показывается
  defaults: Record<Goal, { enabled: boolean; settings: Record<string, unknown> }>;
  todaySection?: (userId: number, ctx: TodayContext) => Promise<string | null>;
}

// Стартовые наборы по цели — из таблицы в концепции (docs/superpowers/specs/2026-10-20-body-diary-concept.md).
export const MODULES: ModuleDef[] = [
  {
    id: 'weight',
    title: '⚖️ Вес и замеры',
    available: false,
    defaults: {
      lose: { enabled: true, settings: { promptTime: '07:30', frequency: 'daily' } },
      gain: { enabled: true, settings: { promptTime: '07:30', frequency: 'weekly' } },
      regular: { enabled: false, settings: { promptTime: '07:30', frequency: 'daily' } },
    },
  },
  {
    id: 'activity',
    title: '🔗 Активность и цепочка',
    available: false,
    defaults: {
      lose: { enabled: true, settings: { chainGoal: 20, maxGapDays: 2 } },
      gain: { enabled: true, settings: { chainGoal: 12, maxGapDays: 2 } },
      regular: { enabled: true, settings: { chainGoal: 10, maxGapDays: 2 } },
    },
  },
  {
    id: 'water',
    title: '💧 Вода',
    available: false,
    defaults: {
      lose: { enabled: true, settings: {} },
      gain: { enabled: true, settings: {} },
      regular: { enabled: true, settings: {} },
    },
  },
  {
    id: 'food',
    title: '🍽 Еда',
    available: false,
    defaults: {
      lose: { enabled: false, settings: {} },
      gain: { enabled: true, settings: {} },
      regular: { enabled: false, settings: {} },
    },
  },
  {
    id: 'sleep',
    title: '😴 Сон и часы',
    available: false,
    defaults: {
      lose: { enabled: false, settings: {} },
      gain: { enabled: true, settings: {} },
      regular: { enabled: false, settings: {} },
    },
  },
];

export function availableModules(): ModuleDef[] {
  return MODULES.filter((m) => m.available);
}

// Строки user_modules для нового профиля: стартовый набор цели + доп. настройки (норма воды).
export function initialModuleRows(
  userId: number,
  goal: Goal,
  extraSettings: Partial<Record<ModuleId, Record<string, unknown>>>
): UserModuleRow[] {
  return MODULES.map((m) => ({
    user_id: userId,
    module: m.id,
    enabled: m.defaults[goal].enabled,
    settings: { ...m.defaults[goal].settings, ...(extraSettings[m.id] ?? {}) },
  }));
}
