# Персональная цель недели + график тоннажа Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить захардкоженную недельную цель (`weekGoal = 3`) на настройку через `/settings` в боте, и вернуть недельный тоннаж как переключаемый график на экране «Прогресс» в Mini App.

**Architecture:** Новая колонка `user_settings.week_goal` (1–7, дефолт 3) читается вместо константы в `getSummary`. Новая функция `getVolumeHistory` агрегирует тоннаж по неделям в JS (тот же паттерн, что уже в `getSummary`/`getProgress`) и отдаётся через новый `GET /api/volume-history`, без зеркала в legacy Vercel-путь. Экран «Прогресс» получает переключатель из двух вкладок: существующий линейный график по упражнению и новый `BarChart` по неделям.

**Tech Stack:** TypeScript, Telegraf, Supabase Postgres, Vite + React + Recharts. Проект не использует автоматических тестов (jest/vitest отсутствуют во всей истории репозитория) — верификация каждого шага через `tsc`/сборку и, где применимо, ручной smoke-прогон, как и во всех предыдущих фичах этого проекта.

**Спек:** [docs/superpowers/specs/2026-07-19-weekly-goal-personalization-design.md](../specs/2026-07-19-weekly-goal-personalization-design.md)

---

### Task 1: Миграция БД — колонка `week_goal`

**Files:**
- Modify: `migrations/schema.sql`

- [ ] **Step 1: Добавить колонку в конец файла**

Открыть `migrations/schema.sql`, после блока `user_settings` (после строки с `create index if not exists idx_user_settings_reminder_time`) добавить:

```sql

-- Персональная недельная цель по числу тренировок (1-7), дефолт 3
alter table user_settings add column if not exists week_goal int not null default 3
  check (week_goal between 1 and 7);
```

- [ ] **Step 2: Применить миграцию к прод-БД**

Run: `supabase db query --linked --file migrations/schema.sql`
Expected: команда завершается без ошибок (0 строк вывода об ошибке). Инструкция идемпотентна (`add column if not exists`) — безопасно перезапускать.

- [ ] **Step 3: Commit**

```bash
git add migrations/schema.sql
git commit -m "feat(db): добавить week_goal в user_settings"
```

---

### Task 2: Контракт `VolumeHistoryResponse`

**Files:**
- Modify: `src/types/webapp.ts`
- Modify: `webapp/shared/types.ts`

- [ ] **Step 1: Добавить типы в `src/types/webapp.ts`**

Добавить после `ProgressResponse` (конец файла):

```ts
export interface VolumeHistoryPoint {
  weekStart: string;
  volumeKg: number;
}

export interface VolumeHistoryResponse {
  weeks: VolumeHistoryPoint[];
}
```

- [ ] **Step 2: Зеркально добавить в `webapp/shared/types.ts`**

Добавить тот же блок после `ProgressResponse` в этом файле:

```ts
export interface VolumeHistoryPoint {
  weekStart: string;
  volumeKg: number;
}

export interface VolumeHistoryResponse {
  weeks: VolumeHistoryPoint[];
}
```

- [ ] **Step 3: Проверить компиляцию бэкенда**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок (новые типы пока нигде не используются, но должны компилироваться сами по себе).

- [ ] **Step 4: Commit**

```bash
git add src/types/webapp.ts webapp/shared/types.ts
git commit -m "feat(webapp): добавить контракт VolumeHistoryResponse"
```

---

### Task 3: `week_goal` в `UserSettings`

**Files:**
- Modify: `src/db/settings.ts`

- [ ] **Step 1: Расширить интерфейс и дефолт**

В `src/db/settings.ts` заменить:

```ts
export interface UserSettings {
  user_id: number;
  reminders_enabled: boolean;
  reminder_time: string | null;
  last_reminder_sent_date: string | null;
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
  reminders_enabled: false,
  reminder_time: null,
  last_reminder_sent_date: null,
};
```

на:

```ts
export interface UserSettings {
  user_id: number;
  reminders_enabled: boolean;
  reminder_time: string | null;
  last_reminder_sent_date: string | null;
  week_goal: number;
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
  reminders_enabled: false,
  reminder_time: null,
  last_reminder_sent_date: null,
  week_goal: 3,
};
```

Остальной файл (`getSettings`, `upsertSettings`, `getUsersNeedingReminder`) не меняется — обе функции уже работают со всей формой `UserSettings` через spread/`select()`.

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/db/settings.ts
git commit -m "feat(db): week_goal в UserSettings с дефолтом 3"
```

---

### Task 4: `getSummary` читает персональную цель + `getVolumeHistory`

**Files:**
- Modify: `src/webapp/queries.ts`

- [ ] **Step 1: Импортировать `getSettings` и новый тип**

В начале `src/webapp/queries.ts` заменить блок импортов:

```ts
import { supabase } from '../db/client';
import { SetEntry } from '../types/domain';
import {
  WorkoutDTO,
  ExerciseDTO,
  CardioDTO,
  SummaryResponse,
  ProgressPoint,
} from '../types/webapp';
```

на:

```ts
import { supabase } from '../db/client';
import { getSettings } from '../db/settings';
import { SetEntry } from '../types/domain';
import {
  WorkoutDTO,
  ExerciseDTO,
  CardioDTO,
  SummaryResponse,
  ProgressPoint,
  VolumeHistoryPoint,
} from '../types/webapp';
```

- [ ] **Step 2: Убрать константу, читать цель из настроек в `getSummary`**

Заменить:

```ts
// Недельная цель по числу тренировок. Пока константа; позже — из профиля
// пользователя (тогда меняется только эта строка, контракт SummaryResponse готов).
const WEEKLY_GOAL_DEFAULT = 3;

// --- Сводка: всего тренировок, недельный стрик, объём и число за текущую неделю ---
export async function getSummary(userId: number): Promise<SummaryResponse> {
  const { data: workoutRows, error } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw new Error(`getSummary/workouts: ${error.message}`);

  const rows = (workoutRows ?? []) as { id: string; date: string }[];
  const totalWorkouts = rows.length;

  const weekKeys = new Set(rows.map((r) => mondayKey(new Date(r.date))));
  const weekStreak = computeWeekStreak(weekKeys);

  const thisWeekKey = mondayKey(new Date());
  const thisWeekIds = rows.filter((r) => mondayKey(new Date(r.date)) === thisWeekKey).map((r) => r.id);
  const weekWorkouts = thisWeekIds.length;
  const weekVolumeKg = await weekVolume(thisWeekIds);

  return { totalWorkouts, weekStreak, weekVolumeKg, weekWorkouts, weekGoal: WEEKLY_GOAL_DEFAULT };
}
```

на:

```ts
// --- Сводка: всего тренировок, недельный стрик, объём и число за текущую неделю ---
export async function getSummary(userId: number): Promise<SummaryResponse> {
  const { data: workoutRows, error } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw new Error(`getSummary/workouts: ${error.message}`);

  const rows = (workoutRows ?? []) as { id: string; date: string }[];
  const totalWorkouts = rows.length;

  const weekKeys = new Set(rows.map((r) => mondayKey(new Date(r.date))));
  const weekStreak = computeWeekStreak(weekKeys);

  const thisWeekKey = mondayKey(new Date());
  const thisWeekIds = rows.filter((r) => mondayKey(new Date(r.date)) === thisWeekKey).map((r) => r.id);
  const weekWorkouts = thisWeekIds.length;
  const [weekVolumeKg, settings] = await Promise.all([weekVolume(thisWeekIds), getSettings(userId)]);

  return { totalWorkouts, weekStreak, weekVolumeKg, weekWorkouts, weekGoal: settings.week_goal };
}
```

- [ ] **Step 3: Добавить `getVolumeHistory` и `lastMondays` в конец файла**

Добавить после `computeWeekStreak` (конец файла):

```ts

// --- История тоннажа по неделям для графика на «Прогрессе» (zero-fill) ---
export async function getVolumeHistory(userId: number, weeks = 12): Promise<VolumeHistoryPoint[]> {
  const weekStarts = lastMondays(weeks); // по возрастанию, [0] — самая старая неделя
  const earliest = weekStarts[0];

  const { data, error } = await supabase
    .from('exercises')
    .select('sets, workouts!inner(user_id, date)')
    .eq('workouts.user_id', userId)
    .gte('workouts.date', earliest)
    .order('date', { foreignTable: 'workouts', ascending: true });
  if (error) throw new Error(`getVolumeHistory: ${error.message}`);

  const totals = new Map<string, number>(weekStarts.map((w) => [w, 0]));
  for (const row of (data ?? []) as unknown as {
    sets: SetEntry[];
    workouts: { date: string } | { date: string }[];
  }[]) {
    const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
    if (!workout?.date) continue;
    const key = mondayKey(new Date(workout.date));
    if (!totals.has(key)) continue; // защита от пограничных строк вне запрошенного окна
    const volume = (row.sets ?? []).reduce((sum, s) => sum + s.weight * s.reps, 0);
    totals.set(key, (totals.get(key) ?? 0) + volume);
  }

  return weekStarts.map((weekStart) => ({ weekStart, volumeKg: Math.round(totals.get(weekStart) ?? 0) }));
}

// Понедельники последних `weeks` недель включительно текущей, по возрастанию дат.
function lastMondays(weeks: number): string[] {
  const cursor = new Date(mondayKey(new Date()) + 'T00:00:00Z');
  const result: string[] = [];
  for (let i = 0; i < weeks; i++) {
    result.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return result;
}
```

- [ ] **Step 4: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/webapp/queries.ts
git commit -m "feat(webapp-backend): персональная цель в getSummary + getVolumeHistory"
```

---

### Task 5: Роут `GET /api/volume-history`

**Files:**
- Modify: `src/webapp/server.ts`

- [ ] **Step 1: Импортировать `getVolumeHistory`**

Заменить:

```ts
import { getHistoryPage, getExerciseNames, getProgress, getSummary } from './queries';
```

на:

```ts
import { getHistoryPage, getExerciseNames, getProgress, getSummary, getVolumeHistory } from './queries';
```

- [ ] **Step 2: Добавить кейс в `switch (url.pathname)`**

В `handleApi`, в `switch (url.pathname)`, после кейса `/api/progress` (перед `default`) добавить:

```ts
      case '/api/volume-history':
        sendJson(res, 200, { weeks: await getVolumeHistory(user.userId) });
        return;

```

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Smoke-тест локально**

Запустить бота локально (только если Render-инстанс сейчас не работает с тем же `BOT_TOKEN` — см. предупреждение в памяти проекта про конфликт `getUpdates`; при сомнении спросить пользователя перед запуском):

Run: `npm run build && npm run start`

В отдельном терминале:

Run: `curl -i http://localhost:3000/api/volume-history`
Expected: `401` с телом вида `{"error":"..."}` (без `X-Telegram-Init-Data` запрос не авторизован — это ожидаемо и подтверждает, что роут существует и проходит через `authOrThrow`, а не падает 404/500).

Остановить локальный процесс (`Ctrl+C`) после проверки.

- [ ] **Step 5: Commit**

```bash
git add src/webapp/server.ts
git commit -m "feat(webapp-backend): роут GET /api/volume-history"
```

---

### Task 6: `/settings` — задать цель недели

**Files:**
- Modify: `src/handlers/settings.ts`

- [ ] **Step 1: Импортировать `pluralizeRu`, добавить `waitingForGoal`**

Заменить:

```ts
import { Telegraf, Markup } from 'telegraf';
import { getSettings, upsertSettings, UserSettings } from '../db/settings';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const waitingForTime = new Set<number>();
```

на:

```ts
import { Telegraf, Markup } from 'telegraf';
import { getSettings, upsertSettings, UserSettings } from '../db/settings';
import { pluralizeRu } from '../utils/format';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const waitingForTime = new Set<number>();
const waitingForGoal = new Set<number>();
```

- [ ] **Step 2: Показать цель в тексте настроек**

Заменить:

```ts
function settingsText(s: UserSettings): string {
  const status = s.reminders_enabled ? 'включены' : 'выключены';
  const time = s.reminder_time ?? 'не задано';
  return `⚙️ Настройки\n\nНапоминания: ${status}\nВремя проверки: ${time} (Europe/Moscow)`;
}
```

на:

```ts
function settingsText(s: UserSettings): string {
  const status = s.reminders_enabled ? 'включены' : 'выключены';
  const time = s.reminder_time ?? 'не задано';
  const goalWord = pluralizeRu(s.week_goal, ['тренировка', 'тренировки', 'тренировок']);
  return `⚙️ Настройки\n\nНапоминания: ${status}\nВремя проверки: ${time} (Europe/Moscow)\nЦель недели: ${s.week_goal} ${goalWord}`;
}
```

- [ ] **Step 3: Добавить кнопку в клавиатуру**

Заменить:

```ts
function settingsKeyboard(s: UserSettings) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        s.reminders_enabled ? '🔕 Выключить напоминания' : '🔔 Включить напоминания',
        s.reminders_enabled ? 's:reminders:off' : 's:reminders:on'
      ),
    ],
    [Markup.button.callback('⏰ Изменить время', 's:time')],
  ]).reply_markup;
}
```

на:

```ts
function settingsKeyboard(s: UserSettings) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        s.reminders_enabled ? '🔕 Выключить напоминания' : '🔔 Включить напоминания',
        s.reminders_enabled ? 's:reminders:off' : 's:reminders:on'
      ),
    ],
    [Markup.button.callback('⏰ Изменить время', 's:time')],
    [Markup.button.callback('🎯 Изменить цель', 's:goal')],
  ]).reply_markup;
}
```

- [ ] **Step 4: Сбрасывать оба состояния при входе в `/settings` и при `s:time`**

Заменить:

```ts
  bot.command('settings', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    waitingForTime.delete(userId);
    const settings = await getSettings(userId);
    await ctx.reply(settingsText(settings), { reply_markup: settingsKeyboard(settings) });
  });
```

на:

```ts
  bot.command('settings', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    waitingForTime.delete(userId);
    waitingForGoal.delete(userId);
    const settings = await getSettings(userId);
    await ctx.reply(settingsText(settings), { reply_markup: settingsKeyboard(settings) });
  });
```

Заменить:

```ts
  bot.action('s:time', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    waitingForTime.add(userId);
    await ctx.reply('Напиши время в формате ЧЧ:ММ (например, 19:30). Часовой пояс — Europe/Moscow.');
  });
```

на:

```ts
  bot.action('s:time', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    waitingForGoal.delete(userId);
    waitingForTime.add(userId);
    await ctx.reply('Напиши время в формате ЧЧ:ММ (например, 19:30). Часовой пояс — Europe/Moscow.');
  });

  bot.action('s:goal', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    waitingForTime.delete(userId);
    waitingForGoal.add(userId);
    await ctx.reply('Сколько тренировок в неделю — цель? Число от 1 до 7.');
  });
```

- [ ] **Step 5: Обработать ввод цели в текстовом роутере**

Заменить:

```ts
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !waitingForTime.has(userId)) {
      return next();
    }

    const text = 'text' in ctx.message ? ctx.message.text.trim() : '';
    if (!TIME_REGEX.test(text)) {
      await ctx.reply('Не понял формат. Пришли время как ЧЧ:ММ, например 07:45.');
      return;
    }

    waitingForTime.delete(userId);
    const settings = await upsertSettings(userId, { reminder_time: text });
    await ctx.reply(`✅ Готово! Время обновлено: ${text} (Europe/Moscow).`, {
      reply_markup: settingsKeyboard(settings),
    });
  });
```

на:

```ts
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    if (waitingForGoal.has(userId)) {
      const text = 'text' in ctx.message ? ctx.message.text.trim() : '';
      const n = Number(text);
      if (!Number.isInteger(n) || n < 1 || n > 7) {
        await ctx.reply('Не понял число. Пришли целое от 1 до 7, например 4.');
        return;
      }

      waitingForGoal.delete(userId);
      const settings = await upsertSettings(userId, { week_goal: n });
      const goalWord = pluralizeRu(n, ['тренировка', 'тренировки', 'тренировок']);
      await ctx.reply(`✅ Готово! Цель недели: ${n} ${goalWord}.`, {
        reply_markup: settingsKeyboard(settings),
      });
      return;
    }

    if (!waitingForTime.has(userId)) {
      return next();
    }

    const text = 'text' in ctx.message ? ctx.message.text.trim() : '';
    if (!TIME_REGEX.test(text)) {
      await ctx.reply('Не понял формат. Пришли время как ЧЧ:ММ, например 07:45.');
      return;
    }

    waitingForTime.delete(userId);
    const settings = await upsertSettings(userId, { reminder_time: text });
    await ctx.reply(`✅ Готово! Время обновлено: ${text} (Europe/Moscow).`, {
      reply_markup: settingsKeyboard(settings),
    });
  });
```

- [ ] **Step 6: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 7: Commit**

```bash
git add src/handlers/settings.ts
git commit -m "feat(bot): настройка цели недели в /settings"
```

---

### Task 7: Клиент API — `volumeHistory`

**Files:**
- Modify: `webapp/src/api.ts`

- [ ] **Step 1: Добавить тип и метод**

Заменить:

```ts
import { getWebApp } from './telegram';
import type { HistoryResponse, ProgressResponse, SummaryResponse, WorkoutUpdateRequest } from '../shared/types';
```

на:

```ts
import { getWebApp } from './telegram';
import type {
  HistoryResponse,
  ProgressResponse,
  SummaryResponse,
  VolumeHistoryResponse,
  WorkoutUpdateRequest,
} from '../shared/types';
```

Заменить:

```ts
export const api = {
  hello: () => get<HelloResponse>('/api/hello'),
  summary: () => get<SummaryResponse>('/api/summary'),
  history: (offset: number, limit: number) =>
    get<HistoryResponse>(`/api/history?offset=${offset}&limit=${limit}`),
  exercises: () => get<{ names: string[] }>('/api/exercises'),
  progress: (exercise: string) =>
    get<ProgressResponse>(`/api/progress?exercise=${encodeURIComponent(exercise)}`),
  updateWorkout: (id: string, body: WorkoutUpdateRequest) =>
    send(`/api/workout/${encodeURIComponent(id)}`, 'PUT', body),
  deleteWorkout: (id: string) => send(`/api/workout/${encodeURIComponent(id)}`, 'DELETE'),
};
```

на:

```ts
export const api = {
  hello: () => get<HelloResponse>('/api/hello'),
  summary: () => get<SummaryResponse>('/api/summary'),
  history: (offset: number, limit: number) =>
    get<HistoryResponse>(`/api/history?offset=${offset}&limit=${limit}`),
  exercises: () => get<{ names: string[] }>('/api/exercises'),
  progress: (exercise: string) =>
    get<ProgressResponse>(`/api/progress?exercise=${encodeURIComponent(exercise)}`),
  volumeHistory: () => get<VolumeHistoryResponse>('/api/volume-history'),
  updateWorkout: (id: string, body: WorkoutUpdateRequest) =>
    send(`/api/workout/${encodeURIComponent(id)}`, 'PUT', body),
  deleteWorkout: (id: string) => send(`/api/workout/${encodeURIComponent(id)}`, 'DELETE'),
};
```

- [ ] **Step 2: Проверить компиляцию webapp**

Run: `npx tsc --noEmit -p webapp/tsconfig.json`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/api.ts
git commit -m "feat(webapp): метод api.volumeHistory"
```

---

### Task 8: Экран «Прогресс» — переключатель + график тоннажа

**Files:**
- Modify: `webapp/src/screens/ProgressScreen.tsx`

- [ ] **Step 1: Заменить весь файл**

Файл целиком заменяется на:

```tsx
import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { ProgressPoint, VolumeHistoryPoint } from '../../shared/types';
import { api, ApiError } from '../api';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { formatDateDDMM, formatVolume } from '../format';
import { haptic } from '../telegram';

type ProgressTab = 'exercise' | 'volume';

export function ProgressScreen() {
  const [names, setNames] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [points, setPoints] = useState<ProgressPoint[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [tab, setTab] = useState<ProgressTab>('exercise');
  const [volumeWeeks, setVolumeWeeks] = useState<VolumeHistoryPoint[] | null>(null);
  const [volumeStatus, setVolumeStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [volumeError, setVolumeError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { names } = await api.exercises();
        if (names.length === 0) {
          setStatus('empty');
          return;
        }
        setNames(names);
        setSelected(names[0]);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setErrorMsg('Открой приложение из Telegram, чтобы увидеть свой прогресс.');
        } else {
          setErrorMsg(err instanceof Error ? err.message : 'Не удалось загрузить упражнения');
        }
        setStatus('error');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setPoints(null);
    (async () => {
      try {
        const res = await api.progress(selected);
        setPoints(res.points);
        setStatus('ready');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Не удалось загрузить прогресс');
        setStatus('error');
      }
    })();
  }, [selected]);

  useEffect(() => {
    if (tab !== 'volume' || volumeStatus !== 'idle') return;
    setVolumeStatus('loading');
    (async () => {
      try {
        const res = await api.volumeHistory();
        setVolumeWeeks(res.weeks);
        setVolumeStatus('ready');
      } catch (err) {
        setVolumeError(err instanceof Error ? err.message : 'Не удалось загрузить тоннаж');
        setVolumeStatus('error');
      }
    })();
  }, [tab, volumeStatus]);

  const maxOverall = useMemo(
    () => (points && points.length ? Math.max(...points.map((p) => p.maxWeight)) : 0),
    [points]
  );

  const switchTab = (next: ProgressTab) => {
    if (next === tab) return;
    haptic('light');
    setTab(next);
  };

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorState title="Ошибка" message={errorMsg} />;
  if (status === 'empty' || !names) {
    return (
      <EmptyState
        emoji="📈"
        title="Пока нечего показать"
        message="Добавь силовую тренировку через бота — и здесь появится график роста весов."
      />
    );
  }

  const chartData = (points ?? []).map((p) => ({ ...p, label: formatDateDDMM(p.date) }));
  const volumeData = (volumeWeeks ?? []).map((w) => ({ ...w, label: formatDateDDMM(w.weekStart) }));

  return (
    <div>
      <div className="progress-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'exercise'}
          className={`progress-tab${tab === 'exercise' ? ' active' : ''}`}
          onClick={() => switchTab('exercise')}
        >
          По упражнению
        </button>
        <button
          role="tab"
          aria-selected={tab === 'volume'}
          className={`progress-tab${tab === 'volume' ? ' active' : ''}`}
          onClick={() => switchTab('volume')}
        >
          Общий тоннаж
        </button>
      </div>

      {tab === 'exercise' ? (
        <>
          <div className="select-wrap">
            <label htmlFor="exercise-select">Упражнение</label>
            <select
              id="exercise-select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {points === null ? (
            <Loading />
          ) : points.length === 0 ? (
            <EmptyState emoji="📭" title="Нет данных" message="По этому упражнению ещё нет записей." />
          ) : (
            <>
              <div className="chart-card">
                <div className="chart-title">Максимальный вес, кг</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
                    <defs>
                      <filter id="gym95-line-glow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--tg-hint)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--tg-hint)' }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      domain={['dataMin - 5', 'dataMax + 5']}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--tg-bg)',
                        border: '1px solid rgba(128,128,128,0.25)',
                        borderRadius: 10,
                        fontSize: 13,
                        color: 'var(--tg-text)',
                      }}
                      labelStyle={{ color: 'var(--tg-hint)' }}
                      formatter={(v: number) => [`${v} кг`, 'макс']}
                    />
                    <Line
                      type="monotone"
                      dataKey="maxWeight"
                      stroke="var(--lime-ink)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--lime-ink)', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: 'var(--lime-ink)' }}
                      filter="url(#gym95-line-glow)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="session-list">
                {[...points].reverse().map((p, i) => (
                  <div key={i} className="session-row">
                    <span className="session-date">{formatDateDDMM(p.date)}</span>
                    <span className={`session-max${p.maxWeight === maxOverall && maxOverall > 0 ? ' pr' : ''}`}>
                      {p.maxWeight} кг{p.maxWeight === maxOverall && maxOverall > 0 ? ' 🏆' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : volumeStatus === 'loading' || volumeStatus === 'idle' ? (
        <Loading />
      ) : volumeStatus === 'error' ? (
        <ErrorState title="Ошибка" message={volumeError} />
      ) : (
        <div className="chart-card">
          <div className="chart-title">Тоннаж по неделям</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volumeData} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--tg-hint)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--tg-hint)' }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--tg-bg)',
                  border: '1px solid rgba(128,128,128,0.25)',
                  borderRadius: 10,
                  fontSize: 13,
                  color: 'var(--tg-text)',
                }}
                labelStyle={{ color: 'var(--tg-hint)' }}
                formatter={(v: number) => [formatVolume(v), 'тоннаж']}
              />
              <Bar dataKey="volumeKg" fill="var(--lime-ink)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверить компиляцию webapp**

Run: `npx tsc --noEmit -p webapp/tsconfig.json`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/screens/ProgressScreen.tsx
git commit -m "feat(webapp): переключатель вкладок и бар-чарт тоннажа на «Прогрессе»"
```

---

### Task 9: Стили переключателя вкладок

**Files:**
- Modify: `webapp/src/styles.css`

- [ ] **Step 1: Добавить стили после блока `.select-wrap`**

В `webapp/src/styles.css`, после блока `.select-wrap label { ... }` (перед `select { ... }`, то есть перед разделом `.chart-card`), добавить:

```css
/* --- Переключатель вкладок на «Прогрессе» --- */
.progress-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}
.progress-tab {
  border: 1px solid color-mix(in srgb, var(--tg-hint) 20%, transparent);
  background: var(--tg-secondary-bg);
  padding: 9px 0;
  border-radius: 999px;
  font-family: var(--font-label);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--tg-hint);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.progress-tab.active {
  border-color: color-mix(in srgb, var(--lime) 55%, transparent);
  color: var(--lime-ink);
  box-shadow: var(--glow);
}
```

- [ ] **Step 2: Собрать webapp и убедиться, что сборка зелёная**

Run: `npm --prefix webapp run build`
Expected: exit code 0, `webapp/dist` пересобран без ошибок TS/Vite.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/styles.css
git commit -m "feat(webapp): стили переключателя вкладок на «Прогрессе»"
```

---

### Task 10: Полная сборка и ручной прогон

**Files:** нет изменений — только верификация.

- [ ] **Step 1: Полная сборка проекта**

Run: `npm run build`
Expected: exit code 0 (компилирует бэкенд `tsc`, затем ставит и собирает `webapp`).

- [ ] **Step 2: Ручной прогон в реальном боте (dogfood)**

Согласовать с пользователем, что Render-инстанс можно ненадолго конфликтовать, либо тестировать после деплоя. Прогнать:
1. `/settings` → «🎯 Изменить цель» → ввести `5` → бот подтверждает, в тексте настроек цель обновилась.
2. Ввести невалидное значение (`0`, `8`, `пять`) → бот просит повторить, режим правки не выходит (следующий валидный ввод всё ещё принимается).
3. Открыть Mini App → плитка «цель недели» показывает `X / 5`.
4. Экран «Прогресс» → вкладка «Общий тоннаж» → бар-чарт за 12 недель отображается, переключение на «По упражнению» и обратно работает без перезагрузки страницы.
5. Аккаунт/период без тренировок за все 12 недель → бар-чарт показывает нулевые столбики без ошибок.
6. Проверить читаемость обеих вкладок в светлой и тёмной теме Telegram (переключить тему в настройках Telegram-клиента).

- [ ] **Step 3: Задеплоить**

```bash
git push
```

Render автоматически задеплоит по пушу в `master` (см. `CLAUDE.md`/память проекта). После деплоя повторить пункты dogfood-прогона (Step 2) уже на проде, если тестировали только локально.

---

## Self-Review

- **Покрытие спека:** раздел 1 (данные/бэкенд) → Tasks 1–5; раздел 2 (`/settings`) → Task 6; раздел 3 (Mini App) → Tasks 7–9; раздел 4 (ошибки/edge cases) → CHECK-constraint в Task 1, zero-fill в Task 4, защита `weekGoal <= 0` не трогается (уже в коде); раздел 5 (файлы) — все перечисленные файлы покрыты задачами. Тестирование из спека → Task 10.
- **Плейсхолдеров нет** — каждый шаг содержит точный код или точную команду с ожидаемым результатом.
- **Согласованность типов:** `VolumeHistoryPoint`/`VolumeHistoryResponse` определены одинаково в Task 2 (оба файла), используются без изменений в Task 4 (бэкенд), Task 7 (клиент), Task 8 (экран). `week_goal` как имя поля везде одинаковое (БД-колонка, `UserSettings`, `upsertSettings` patch).
