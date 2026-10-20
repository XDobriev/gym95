# Этап 1: фундамент для многих пользователей — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить личного бота в бота для круга друзей: профиль, знакомство, вход по приглашению, часовой пояс каждого, реестр модулей, `/today`, `/settings` по разделам, тренировки задним числом.

**Architecture:** Расширяем существующий код (Telegraf + supabase-js), не переписываем. Новые чистые утилиты (`time`, `norms`, `parse`, `decideAccess`) покрываются `node:test`. Доступ контролирует первый middleware: без профиля пропускает только знакомство. Знакомство — ещё один FSM в памяти, подключённый к `activeFlow`. Создание профиля и списание приглашения выполняет одна Postgres-функция.

**Tech Stack:** Node 22, TypeScript 5, Telegraf 4, @supabase/supabase-js 2, node-cron, `node:test` через `tsx`.

Спек: [docs/superpowers/specs/2026-10-20-multiuser-foundation-design.md](../specs/2026-10-20-multiuser-foundation-design.md).

## Правила исполнения

- **Не коммитить.** В этом репозитории коммиты делает параллельный процесс. Вместо шага «Commit» в каждой задаче идёт шаг «Проверка»: `npx tsc --noEmit -p tsconfig.json` и `npm test`.
- **Не запускать бота локально** (`npm run dev`, `node dist/bot.js`): прод на Render держит тот же `getUpdates`, и экземпляры будут выбивать друг друга (409).
- **`src/handlers/workout/*` параллельно меняет реализация «Повтора тренировки».** Задача 14 трогает эти файлы. Перед ней выполнить `git status` и `git diff src/handlers/workout src/types/draft.ts`, вносить правки поверх чужих изменений, ничего не откатывать.
- **Миграцию к прод-базе (задача 4, шаг 3) применять только после явного «да» пользователя.**

## Отступления от спека (осознанные)

- Анонс новых модулей («Новое: … Включить?») не реализуется в этапе 1. В спеке он «закладывается», но анонсировать пока нечего (YAGNI). Реализуется в этапе 2 вместе с первым доступным модулем. Флаг `available` и поле `settings` в `user_modules` уже есть.
- Кнопка «📅 Другая дата» для «Повтора тренировки» в этот план не входит: повтор сейчас реализует параллельный процесс. Кнопку добавить отдельно, когда повтор будет влит (переиспользовав `dateKeyboard` и `applyChosenDate` из задачи 14).
- При смене цели в `/settings` бот ничего не предлагает пересчитать: норма воды от цели не зависит, а модули в этапе 1 недоступны. Пересчёт нормы воды предлагается при смене роста или веса.

## Карта файлов

Создать:
- `src/utils/time.ts` (+ `time.test.ts`) — местные дата и время, перевод местного времени в UTC, понедельник недели.
- `src/utils/timezones.ts` — список поясов РФ и подписи.
- `src/utils/norms.ts` (+ `norms.test.ts`) — норма воды.
- `src/utils/parse.ts` (+ `parse.test.ts`) — `parseBodyLine`, `parseDayMonth`.
- `src/types/profile.ts` — типы `Goal`, `Sex`, `Profile`.
- `src/db/profiles.ts` — профиль, кэш, создание через RPC, обновление, вес.
- `src/db/modules.ts` — строки `user_modules`.
- `src/db/invites.ts` — создание приглашений.
- `src/modules/registry.ts` — реестр модулей и стартовые наборы по цели.
- `src/handlers/accessDecision.ts` (+ `accessDecision.test.ts`) — чистая функция решения о доступе.
- `src/handlers/access.ts` — middleware доступа и команда `/invite`.
- `src/handlers/onboarding/state.ts`, `src/handlers/onboarding/index.ts` — FSM знакомства.
- `src/handlers/today.ts` — экран `/today`.
- `src/handlers/settingsProfile.ts` — раздел «Профиль» в `/settings`.

Изменить:
- `package.json`, `tsconfig.json` — тесты.
- `migrations/schema.sql` — новые таблицы и функция.
- `src/config.ts` — `OWNER_ID`.
- `src/botInstance.ts` — порядок регистрации, `bot.catch`.
- `src/handlers/activeFlow.ts` — поток `onboarding`.
- `src/handlers/start.ts` — приветствие для пользователей с профилем.
- `src/handlers/webapp.ts` — список команд.
- `src/handlers/settings.ts`, `src/handlers/settingsState.ts` — меню разделов, пояс вместо «Europe/Moscow».
- `src/db/settings.ts`, `src/cron/reminders.ts` — напоминания по поясу пользователя.
- `src/db/workouts.ts` — `countWorkoutsSince`.
- `src/webapp/queries.ts` — недели по поясу пользователя.
- `src/webapp/server.ts` — 403 без профиля.
- `src/types/draft.ts`, `src/handlers/workout/{state,keyboards,index,finish}.ts` — задним числом (задача 14).

---

### Task 1: Тестовая инфраструктура и `time.ts`

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `src/utils/time.ts`
- Test: `src/utils/time.test.ts`

- [ ] **Step 1: Скрипт тестов и исключение тестов из сборки**

`package.json`, в `scripts` добавить строку после `"dev"`:

```json
    "test": "tsx --test \"src/**/*.test.ts\"",
```

`tsconfig.json`, заменить `exclude`:

```json
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
```

- [ ] **Step 2: Написать падающий тест**

`src/utils/time.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localNow, localNoonUtc, localMidnightUtc, localWeekStart, addDays, daysBetween, weekStartOf } from './time';

test('localNow: Москва после полуночи по местному, ещё прошлый день по UTC', () => {
  const r = localNow('Europe/Moscow', new Date('2026-10-20T22:30:00Z'));
  assert.equal(r.dateStr, '2026-10-21');
  assert.equal(r.hhmm, '01:30');
  assert.equal(r.weekday, 2); // среда: 0=пн..6=вс
});

test('localNow: Владивосток UTC+10', () => {
  const r = localNow('Asia/Vladivostok', new Date('2026-10-20T14:30:00Z'));
  assert.equal(r.dateStr, '2026-10-21');
  assert.equal(r.hhmm, '00:30');
});

test('localNow: полночь даёт 00, а не 24', () => {
  const r = localNow('Europe/Moscow', new Date('2026-10-20T21:00:00Z'));
  assert.equal(r.hhmm, '00:00');
});

test('localNoonUtc для разных поясов', () => {
  assert.equal(localNoonUtc('2026-10-20', 'Europe/Moscow').toISOString(), '2026-10-20T09:00:00.000Z');
  assert.equal(localNoonUtc('2026-10-20', 'Asia/Vladivostok').toISOString(), '2026-10-20T02:00:00.000Z');
  assert.equal(localNoonUtc('2026-10-20', 'Europe/Kaliningrad').toISOString(), '2026-10-20T10:00:00.000Z');
});

test('localNoonUtc возвращает ту же местную дату', () => {
  const d = localNoonUtc('2026-10-20', 'Asia/Kamchatka');
  assert.equal(localNow('Asia/Kamchatka', d).dateStr, '2026-10-20');
});

test('localMidnightUtc для Москвы', () => {
  assert.equal(localMidnightUtc('2026-10-19', 'Europe/Moscow').toISOString(), '2026-10-18T21:00:00.000Z');
});

test('localWeekStart: вторник и воскресенье дают понедельник 19.10, понедельник — себя', () => {
  assert.equal(localWeekStart('Europe/Moscow', new Date('2026-10-20T09:00:00Z')), '2026-10-19');
  assert.equal(localWeekStart('Europe/Moscow', new Date('2026-10-25T09:00:00Z')), '2026-10-19');
  assert.equal(localWeekStart('Europe/Moscow', new Date('2026-10-26T09:00:00Z')), '2026-10-26');
});

test('weekStartOf: момент в воскресенье 23:30 по Москве — ещё прошлая неделя', () => {
  assert.equal(weekStartOf(new Date('2026-10-25T20:30:00Z'), 'Europe/Moscow'), '2026-10-19');
});

test('addDays и daysBetween через границу месяца и года', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2025-10-20', '2026-10-20'), 365);
  assert.equal(daysBetween('2026-10-20', '2026-10-18'), -2);
});
```

- [ ] **Step 3: Запустить и убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module './time'`.

- [ ] **Step 4: Реализация**

`src/utils/time.ts`:

```ts
// Местные дата/время пользователя по IANA-поясу. Только Intl, без сторонних библиотек.
// Хост Render работает в UTC, поэтому всё «сегодня/сейчас/неделя» считается здесь.

export const DEFAULT_TZ = 'Europe/Moscow';

export interface LocalNow {
  dateStr: string; // YYYY-MM-DD
  hhmm: string; // HH:MM, 00..23
  weekday: number; // 0=пн .. 6=вс
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(tz, f);
  }
  return f;
}

function partsOf(date: Date, tz: string): { y: number; m: number; d: number; h: number; min: number } {
  const parts = formatter(tz).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, min: get('minute') };
}

const pad = (n: number) => String(n).padStart(2, '0');

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseDateStr(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

// 0=пн .. 6=вс для календарной даты (не зависит от пояса).
function weekdayOf(dateStr: string): number {
  const { y, m, d } = parseDateStr(dateStr);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function localNow(tz: string, now: Date = new Date()): LocalNow {
  const p = partsOf(now, tz);
  const dateStr = toDateStr(p.y, p.m, p.d);
  return { dateStr, hhmm: `${pad(p.h)}:${pad(p.min)}`, weekday: weekdayOf(dateStr) };
}

export function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDateStr(dateStr);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toDateStr(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// Сколько календарных дней от a до b (b - a).
export function daysBetween(a: string, b: string): number {
  const pa = parseDateStr(a);
  const pb = parseDateStr(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

// Смещение пояса относительно UTC в мс в данный момент.
function offsetMs(tz: string, at: Date): number {
  const p = partsOf(at, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return asUtc - Math.floor(at.getTime() / 60_000) * 60_000;
}

function localTimeToUtc(dateStr: string, hours: number, minutes: number, tz: string): Date {
  const { y, m, d } = parseDateStr(dateStr);
  const guess = Date.UTC(y, m - 1, d, hours, minutes);
  let result = guess - offsetMs(tz, new Date(guess));
  // Вторая итерация на случай перехода на летнее время между guess и result.
  result = guess - offsetMs(tz, new Date(result));
  return new Date(result);
}

export function localMidnightUtc(dateStr: string, tz: string): Date {
  return localTimeToUtc(dateStr, 0, 0, tz);
}

// Полдень выбранного местного дня — безопасная точка: дата не «съедет» ни в каком поясе.
export function localNoonUtc(dateStr: string, tz: string): Date {
  return localTimeToUtc(dateStr, 12, 0, tz);
}

// Понедельник местной недели, в которую попадает момент `at`.
export function weekStartOf(at: Date, tz: string): string {
  const { dateStr, weekday } = localNow(tz, at);
  return addDays(dateStr, -weekday);
}

export function localWeekStart(tz: string, now: Date = new Date()): string {
  return weekStartOf(now, tz);
}
```

- [ ] **Step 5: Запустить тесты**

Run: `npm test`
Expected: PASS, 9 тестов.

- [ ] **Step 6: Проверка**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: без ошибок. Не коммитить.

---

### Task 2: Норма воды `norms.ts`

**Files:**
- Create: `src/utils/norms.ts`
- Test: `src/utils/norms.test.ts`

- [ ] **Step 1: Падающий тест**

`src/utils/norms.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterNormMl } from './norms';

test('проверочные точки из спека', () => {
  assert.equal(waterNormMl({ heightCm: 182, weightKg: 95 }), 2500);
  assert.equal(waterNormMl({ heightCm: 182, weightKg: 130 }), 2750);
  assert.equal(waterNormMl({ heightCm: 160, weightKg: 50 }), 1500);
});

test('нижняя граница 1500 мл', () => {
  assert.equal(waterNormMl({ heightCm: 150, weightKg: 40 }), 1500);
});

test('верхняя граница 3000 мл', () => {
  assert.equal(waterNormMl({ heightCm: 200, weightKg: 300 }), 3000);
});

test('результат кратен 250', () => {
  for (let w = 40; w <= 200; w += 7) {
    assert.equal(waterNormMl({ heightCm: 175, weightKg: w }) % 250, 0);
  }
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL `Cannot find module './norms'`.

- [ ] **Step 3: Реализация**

`src/utils/norms.ts`:

```ts
const ML_PER_KG = 30;
const MIN_ML = 1500;
const MAX_ML = 3000;
const STEP_ML = 250;
const IDEAL_BMI = 22;
const EXCESS_FACTOR = 0.4; // жировой ткани вода почти не нужна — учитываем 40% лишнего веса

// Суточная норма питья в мл. При весе выше «идеального» (ИМТ 22) считаем от
// приведённого веса, иначе правило 30 мл/кг даёт 4+ литра при большом весе.
export function waterNormMl(p: { heightCm: number; weightKg: number }): number {
  const h = p.heightCm / 100;
  const ideal = IDEAL_BMI * h * h;
  const effective = p.weightKg > ideal ? ideal + EXCESS_FACTOR * (p.weightKg - ideal) : p.weightKg;
  const rounded = Math.round((ML_PER_KG * effective) / STEP_ML) * STEP_ML;
  return Math.min(MAX_ML, Math.max(MIN_ML, rounded));
}

export function formatLiters(ml: number): string {
  return `${(ml / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} л`;
}
```

- [ ] **Step 4: Run** `npm test` — Expected: PASS.

- [ ] **Step 5: Проверка** `npx tsc --noEmit -p tsconfig.json`. Не коммитить.

---

### Task 3: Разбор ввода `parse.ts`

**Files:**
- Create: `src/utils/parse.ts`
- Test: `src/utils/parse.test.ts`

- [ ] **Step 1: Падающий тест**

`src/utils/parse.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBodyLine, parseDayMonth } from './parse';

test('parseBodyLine: пробелы', () => {
  assert.deepEqual(parseBodyLine('182 95 34'), { ok: true, heightCm: 182, weightKg: 95, age: 34 });
});

test('parseBodyLine: дробный вес через запятую и точку, разделители-запятые', () => {
  assert.deepEqual(parseBodyLine('182 95,5 34'), { ok: true, heightCm: 182, weightKg: 95.5, age: 34 });
  assert.deepEqual(parseBodyLine('182, 95.5, 34'), { ok: true, heightCm: 182, weightKg: 95.5, age: 34 });
});

test('parseBodyLine: не три числа', () => {
  assert.equal(parseBodyLine('182 95').ok, false);
  assert.equal(parseBodyLine('182 95 34 1').ok, false);
  assert.equal(parseBodyLine('рост 182').ok, false);
});

test('parseBodyLine: диапазоны', () => {
  assert.equal(parseBodyLine('100 95 34').ok, false);
  assert.equal(parseBodyLine('182 20 34').ok, false);
  assert.equal(parseBodyLine('182 95 8').ok, false);
  assert.equal(parseBodyLine('182 301 34').ok, false);
});

const TODAY = '2026-10-20';

test('parseDayMonth: дд.мм в этом году', () => {
  assert.deepEqual(parseDayMonth('18.10', TODAY), { ok: true, dateStr: '2026-10-18' });
  assert.deepEqual(parseDayMonth('20.10', TODAY), { ok: true, dateStr: '2026-10-20' });
});

test('parseDayMonth: дата позже сегодняшней без года — прошлый год', () => {
  assert.deepEqual(parseDayMonth('25.12', TODAY), { ok: true, dateStr: '2025-12-25' });
});

test('parseDayMonth: явный год', () => {
  assert.deepEqual(parseDayMonth('01.03.2026', TODAY), { ok: true, dateStr: '2026-03-01' });
});

test('parseDayMonth: будущее и старше года — ошибка', () => {
  assert.equal(parseDayMonth('21.10.2026', TODAY).ok, false);
  assert.equal(parseDayMonth('19.10.2025', TODAY).ok, false);
  assert.deepEqual(parseDayMonth('20.10.2025', TODAY), { ok: true, dateStr: '2025-10-20' });
});

test('parseDayMonth: несуществующие даты и мусор', () => {
  assert.equal(parseDayMonth('31.04', TODAY).ok, false);
  assert.equal(parseDayMonth('29.02', TODAY).ok, false); // 2026 не високосный
  assert.equal(parseDayMonth('вчера', TODAY).ok, false);
  assert.equal(parseDayMonth('1810', TODAY).ok, false);
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL `Cannot find module './parse'`.

- [ ] **Step 3: Реализация**

`src/utils/parse.ts`:

```ts
import { daysBetween } from './time';

export type BodyLineResult =
  | { ok: true; heightCm: number; weightKg: number; age: number }
  | { ok: false; error: string };

const BODY_EXAMPLE = 'Напиши рост (см), вес (кг) и возраст через пробел, например: 182 95 34';

// «182 95 34», «182 95,5 34», «182, 95.5, 34».
export function parseBodyLine(text: string): BodyLineResult {
  const tokens = text.trim().replace(/,\s+/g, ' ').split(/\s+/).filter(Boolean);
  if (tokens.length !== 3) return { ok: false, error: BODY_EXAMPLE };

  const nums = tokens.map((t) => Number(t.replace(',', '.')));
  if (nums.some((n) => !Number.isFinite(n))) return { ok: false, error: BODY_EXAMPLE };

  const [heightCm, weightRaw, age] = [Math.round(nums[0]), nums[1], Math.round(nums[2])];
  const weightKg = Math.round(weightRaw * 10) / 10;

  if (heightCm < 120 || heightCm > 230) return { ok: false, error: `Рост должен быть от 120 до 230 см. ${BODY_EXAMPLE}` };
  if (weightKg < 35 || weightKg > 300) return { ok: false, error: `Вес должен быть от 35 до 300 кг. ${BODY_EXAMPLE}` };
  if (age < 12 || age > 90) return { ok: false, error: `Возраст должен быть от 12 до 90 лет. ${BODY_EXAMPLE}` };

  return { ok: true, heightCm, weightKg, age };
}

export type DayMonthResult = { ok: true; dateStr: string } | { ok: false; error: string };

const DATE_EXAMPLE = 'Напиши дату как дд.мм, например 18.10';
const MAX_DAYS_BACK = 365;

function isValidDate(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const pad = (n: number) => String(n).padStart(2, '0');

// «дд.мм» или «дд.мм.гггг». Без года — ближайшая не будущая дата (этот или прошлый год).
export function parseDayMonth(text: string, todayStr: string): DayMonthResult {
  const match = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/.exec(text.trim());
  if (!match) return { ok: false, error: DATE_EXAMPLE };

  const d = Number(match[1]);
  const m = Number(match[2]);
  const todayYear = Number(todayStr.slice(0, 4));
  let y = match[3] ? Number(match[3]) : todayYear;

  if (!match[3]) {
    const candidate = `${y}-${pad(m)}-${pad(d)}`;
    if (candidate > todayStr) y -= 1;
  }

  if (!isValidDate(y, m, d)) return { ok: false, error: `Такой даты нет. ${DATE_EXAMPLE}` };

  const dateStr = `${y}-${pad(m)}-${pad(d)}`;
  const back = daysBetween(dateStr, todayStr);
  if (back < 0) return { ok: false, error: 'Нельзя записать тренировку в будущее.' };
  if (back > MAX_DAYS_BACK) return { ok: false, error: 'Можно записать тренировку не старше года.' };

  return { ok: true, dateStr };
}
```

- [ ] **Step 4: Run** `npm test` — Expected: PASS.

- [ ] **Step 5: Проверка** `npx tsc --noEmit -p tsconfig.json`. Не коммитить.

---

### Task 4: Миграция базы

**Files:**
- Modify: `migrations/schema.sql` (дописать в конец)

- [ ] **Step 1: Дописать в конец `migrations/schema.sql`**

```sql

-- ===== Этап 1: многопользовательский фундамент (2026-10-20) =====

create table if not exists profiles (
  user_id      bigint primary key,
  goal         text not null check (goal in ('lose', 'gain', 'regular')),
  sex          text not null check (sex in ('male', 'female')),
  birth_year   int  not null check (birth_year between 1930 and 2020),
  height_cm    int  not null check (height_cm between 120 and 230),
  timezone     text not null default 'Europe/Moscow',
  invited_by   bigint null,
  onboarded_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create table if not exists user_modules (
  user_id  bigint not null,
  module   text   not null check (module in ('weight', 'activity', 'water', 'food', 'sleep')),
  enabled  boolean not null default false,
  settings jsonb  not null default '{}'::jsonb,
  primary key (user_id, module)
);

create table if not exists invites (
  code       text primary key,
  created_by bigint not null,
  uses_left  int not null default 1 check (uses_left >= 0),
  created_at timestamptz not null default now()
);

create table if not exists body_weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     bigint not null,
  weight_kg   numeric(5,1) not null check (weight_kg between 35 and 300),
  measured_at timestamptz not null default now()
);

create index if not exists idx_body_weights_user_time on body_weights (user_id, measured_at desc);

-- Бот ходит в базу service_role-ключом (RLS его не касается). RLS без политик
-- закрывает новые таблицы от anon-ключа через PostgREST.
alter table profiles enable row level security;
alter table user_modules enable row level security;
alter table invites enable row level security;
alter table body_weights enable row level security;

-- Атомарно: списать приглашение (если передано), создать профиль, записать первый вес.
-- p_invite_code = null — для владельца бота. Ошибка 'invite_invalid', если код не найден или исчерпан.
create or replace function redeem_invite_and_create_profile(
  p_user_id bigint,
  p_invite_code text,
  p_goal text,
  p_sex text,
  p_birth_year int,
  p_height_cm int,
  p_timezone text,
  p_weight_kg numeric
) returns void
language plpgsql
as $$
declare
  v_inviter bigint := null;
begin
  if p_invite_code is not null then
    update invites set uses_left = uses_left - 1
      where code = p_invite_code and uses_left > 0
      returning created_by into v_inviter;
    if not found then
      raise exception 'invite_invalid';
    end if;
  end if;

  insert into profiles (user_id, goal, sex, birth_year, height_cm, timezone, invited_by)
    values (p_user_id, p_goal, p_sex, p_birth_year, p_height_cm, p_timezone, v_inviter);

  insert into body_weights (user_id, weight_kg) values (p_user_id, p_weight_kg);
end;
$$;

revoke execute on function redeem_invite_and_create_profile(bigint, text, text, text, int, int, text, numeric)
  from public, anon, authenticated;
```

- [ ] **Step 2: Проверить идемпотентность глазами.** Все `create` — `if not exists` или `or replace`, `alter ... enable row level security` повторно безопасен, остальной файл уже применялся. Файл целиком можно применять повторно.

- [ ] **Step 3: Применить к базе — ТОЛЬКО после «да» пользователя**

Спросить пользователя: «Применить миграцию этапа 1 к прод-базе Supabase? Она только добавляет таблицы, текущий бот продолжит работать». После подтверждения:

Run: `npx supabase db query --linked -f migrations/schema.sql`
Expected: без ошибок.

Проверка:

Run: `npx supabase db query --linked "select table_name from information_schema.tables where table_name in ('profiles','user_modules','invites','body_weights') order by 1"`
Expected: четыре строки.

---

### Task 5: Конфиг, типы профиля, слой БД

**Files:**
- Modify: `src/config.ts`
- Create: `src/types/profile.ts`
- Create: `src/db/profiles.ts`
- Create: `src/db/modules.ts`
- Create: `src/db/invites.ts`
- Modify: `.env` (локально, не коммитится): добавить `OWNER_ID`

- [ ] **Step 1: `OWNER_ID` в конфиге**

`src/config.ts`, после `requireEnv` добавить функцию и поле:

```ts
function requireIntEnv(name: string): number {
  const raw = requireEnv(name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Переменная окружения ${name} должна быть положительным целым числом (Telegram id), сейчас: "${raw}".`);
  }
  return value;
}
```

и в объекте `config` после `SUPABASE_KEY`:

```ts
  // Telegram id владельца бота: проходит знакомство без приглашения и может делать /invite.
  OWNER_ID: requireIntEnv('OWNER_ID'),
```

Узнать id владельца: `select distinct user_id from user_settings` или `workouts`. Если база пустая (после восстановления 20.10 она пустая), спросить у пользователя: id показывает, например, @userinfobot. Записать `OWNER_ID=<id>` в локальный `.env`. Если в репозитории есть `.env.example`, добавить туда строку `OWNER_ID=` с комментарием.

- [ ] **Step 2: Типы**

`src/types/profile.ts`:

```ts
export type Goal = 'lose' | 'gain' | 'regular';
export type Sex = 'male' | 'female';

export interface Profile {
  user_id: number;
  goal: Goal;
  sex: Sex;
  birth_year: number;
  height_cm: number;
  timezone: string;
  invited_by: number | null;
  onboarded_at: string;
  created_at: string;
}

export const GOAL_LABELS: Record<Goal, string> = {
  lose: '📉 Похудеть',
  gain: '💪 Набрать мышцы',
  regular: '🔁 Регулярность и форма',
};

export const SEX_LABELS: Record<Sex, string> = {
  male: 'Мужской',
  female: 'Женский',
};
```

- [ ] **Step 3: `src/db/profiles.ts`**

```ts
import { supabase } from './client';
import { Goal, Profile, Sex } from '../types/profile';
import { DEFAULT_TZ } from '../utils/time';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, { profile: Profile | null; at: number }>();

export async function getProfile(userId: number): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select().eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return (data as Profile | null) ?? null;
}

// Профиль с кэшем на 5 минут: middleware доступа зовёт это на каждый апдейт.
export async function getProfileCached(userId: number): Promise<Profile | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.profile;
  const profile = await getProfile(userId);
  cache.set(userId, { profile, at: Date.now() });
  return profile;
}

export function invalidateProfile(userId: number): void {
  cache.delete(userId);
}

export async function getUserTimezone(userId: number): Promise<string> {
  return (await getProfileCached(userId))?.timezone ?? DEFAULT_TZ;
}

export async function getTimezones(userIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabase.from('profiles').select('user_id, timezone').in('user_id', userIds);
  if (error) throw new Error(`getTimezones: ${error.message}`);
  for (const row of (data ?? []) as { user_id: number; timezone: string }[]) map.set(row.user_id, row.timezone);
  return map;
}

export interface NewProfileInput {
  userId: number;
  inviteCode: string | null;
  goal: Goal;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  timezone: string;
  weightKg: number;
}

export type CreateProfileResult = 'created' | 'invite_invalid' | 'already_exists';

export async function createProfileWithInvite(input: NewProfileInput): Promise<CreateProfileResult> {
  const { error } = await supabase.rpc('redeem_invite_and_create_profile', {
    p_user_id: input.userId,
    p_invite_code: input.inviteCode,
    p_goal: input.goal,
    p_sex: input.sex,
    p_birth_year: input.birthYear,
    p_height_cm: input.heightCm,
    p_timezone: input.timezone,
    p_weight_kg: input.weightKg,
  });
  invalidateProfile(input.userId);
  if (!error) return 'created';
  if (error.message.includes('invite_invalid')) return 'invite_invalid';
  if (error.code === '23505') return 'already_exists';
  throw new Error(`createProfileWithInvite: ${error.message}`);
}

export async function updateProfile(
  userId: number,
  patch: Partial<Pick<Profile, 'goal' | 'sex' | 'birth_year' | 'height_cm' | 'timezone'>>
): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(patch).eq('user_id', userId).select().single();
  invalidateProfile(userId);
  if (error) throw new Error(`updateProfile: ${error.message}`);
  return data as Profile;
}

export async function addBodyWeight(userId: number, weightKg: number): Promise<void> {
  const { error } = await supabase.from('body_weights').insert({ user_id: userId, weight_kg: weightKg });
  if (error) throw new Error(`addBodyWeight: ${error.message}`);
}

export async function getLatestWeight(userId: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('body_weights')
    .select('weight_kg')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestWeight: ${error.message}`);
  return data ? Number((data as { weight_kg: number | string }).weight_kg) : null;
}
```

- [ ] **Step 4: `src/db/modules.ts`**

```ts
import { supabase } from './client';

export type ModuleId = 'weight' | 'activity' | 'water' | 'food' | 'sleep';

export interface UserModuleRow {
  user_id: number;
  module: ModuleId;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export async function getModules(userId: number): Promise<UserModuleRow[]> {
  const { data, error } = await supabase.from('user_modules').select().eq('user_id', userId);
  if (error) throw new Error(`getModules: ${error.message}`);
  return (data ?? []) as UserModuleRow[];
}

export async function upsertModules(rows: UserModuleRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('user_modules').upsert(rows, { onConflict: 'user_id,module' });
  if (error) throw new Error(`upsertModules: ${error.message}`);
}

export async function patchModuleSettings(userId: number, module: ModuleId, patch: Record<string, unknown>): Promise<void> {
  const rows = await getModules(userId);
  const current = rows.find((r) => r.module === module);
  await upsertModules([
    {
      user_id: userId,
      module,
      enabled: current?.enabled ?? false,
      settings: { ...(current?.settings ?? {}), ...patch },
    },
  ]);
}
```

- [ ] **Step 5: `src/db/invites.ts`**

```ts
import { randomInt } from 'crypto';
import { supabase } from './client';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const INVITE_CODE_LENGTH = 8;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export async function createInvite(createdBy: number): Promise<string> {
  const code = generateCode();
  const { error } = await supabase.from('invites').insert({ code, created_by: createdBy, uses_left: 1 });
  if (error) throw new Error(`createInvite: ${error.message}`);
  return code;
}
```

- [ ] **Step 6: Проверка** `npx tsc --noEmit -p tsconfig.json` и `npm test`. Не коммитить.

---

### Task 6: Часовые пояса РФ и реестр модулей

**Files:**
- Create: `src/utils/timezones.ts`
- Create: `src/modules/registry.ts`

- [ ] **Step 1: `src/utils/timezones.ts`**

```ts
export interface TzOption {
  iana: string;
  label: string; // «МСК+2»
  city: string;
}

export const RU_TIMEZONES: TzOption[] = [
  { iana: 'Europe/Moscow', label: 'МСК', city: 'Москва' },
  { iana: 'Europe/Kaliningrad', label: 'МСК−1', city: 'Калининград' },
  { iana: 'Europe/Samara', label: 'МСК+1', city: 'Самара' },
  { iana: 'Asia/Yekaterinburg', label: 'МСК+2', city: 'Екатеринбург' },
  { iana: 'Asia/Omsk', label: 'МСК+3', city: 'Омск' },
  { iana: 'Asia/Krasnoyarsk', label: 'МСК+4', city: 'Красноярск' },
  { iana: 'Asia/Irkutsk', label: 'МСК+5', city: 'Иркутск' },
  { iana: 'Asia/Yakutsk', label: 'МСК+6', city: 'Якутск' },
  { iana: 'Asia/Vladivostok', label: 'МСК+7', city: 'Владивосток' },
  { iana: 'Asia/Magadan', label: 'МСК+8', city: 'Магадан' },
  { iana: 'Asia/Kamchatka', label: 'МСК+9', city: 'Камчатка' },
];

export function isKnownTimezone(iana: string): boolean {
  return RU_TIMEZONES.some((t) => t.iana === iana);
}

export function tzLabel(iana: string): string {
  const t = RU_TIMEZONES.find((x) => x.iana === iana);
  return t ? `${t.label} (${t.city})` : iana;
}
```

- [ ] **Step 2: `src/modules/registry.ts`**

```ts
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
```

- [ ] **Step 3: Проверка** `npx tsc --noEmit -p tsconfig.json`. Не коммитить.

---

### Task 7: Решение о доступе (чистая функция)

**Files:**
- Create: `src/handlers/accessDecision.ts`
- Test: `src/handlers/accessDecision.test.ts`

- [ ] **Step 1: Падающий тест**

`src/handlers/accessDecision.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccess, extractInviteCode } from './accessDecision';

const base = { isOwner: false, hasProfile: false, onboardingInProgress: false, startPayload: null };

test('есть профиль — allow', () => {
  assert.equal(decideAccess({ ...base, hasProfile: true }), 'allow');
  assert.equal(decideAccess({ ...base, hasProfile: true, startPayload: 'inv_abcd1234' }), 'allow');
});

test('владелец без профиля — onboard', () => {
  assert.equal(decideAccess({ ...base, isOwner: true }), 'onboard');
});

test('идёт знакомство — onboard', () => {
  assert.equal(decideAccess({ ...base, onboardingInProgress: true }), 'onboard');
});

test('приглашение правильного формата — onboard', () => {
  assert.equal(decideAccess({ ...base, startPayload: 'inv_abcd1234' }), 'onboard');
});

test('чужой без приглашения или с мусором — deny', () => {
  assert.equal(decideAccess(base), 'deny');
  assert.equal(decideAccess({ ...base, startPayload: 'hello' }), 'deny');
  assert.equal(decideAccess({ ...base, startPayload: 'inv_short' }), 'deny');
});

test('extractInviteCode', () => {
  assert.equal(extractInviteCode('inv_abcd1234'), 'abcd1234');
  assert.equal(extractInviteCode('inv_ABCD1234'), null);
  assert.equal(extractInviteCode(null), null);
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL `Cannot find module './accessDecision'`.

- [ ] **Step 3: Реализация**

`src/handlers/accessDecision.ts`:

```ts
export type AccessDecision = 'allow' | 'onboard' | 'deny';

export interface AccessInput {
  isOwner: boolean;
  hasProfile: boolean;
  onboardingInProgress: boolean;
  startPayload: string | null;
}

const INVITE_PAYLOAD = /^inv_([a-z0-9]{8})$/;

export function extractInviteCode(payload: string | null): string | null {
  if (!payload) return null;
  const m = INVITE_PAYLOAD.exec(payload);
  return m ? m[1] : null;
}

// Действительность самого кода проверяется при создании профиля (атомарно в БД),
// здесь — только формат.
export function decideAccess(input: AccessInput): AccessDecision {
  if (input.hasProfile) return 'allow';
  if (input.isOwner || input.onboardingInProgress) return 'onboard';
  if (extractInviteCode(input.startPayload)) return 'onboard';
  return 'deny';
}

// Аргумент /start из текста сообщения: «/start inv_x» или «/start@bot inv_x».
export function extractStartPayload(text: string | undefined): string | null {
  if (!text) return null;
  const m = /^\/start(?:@\w+)?\s+(\S+)/.exec(text.trim());
  return m ? m[1] : null;
}
```

Добавить в тест:

```ts
import { extractStartPayload } from './accessDecision';

test('extractStartPayload', () => {
  assert.equal(extractStartPayload('/start inv_abcd1234'), 'inv_abcd1234');
  assert.equal(extractStartPayload('/start@gym95_bot inv_abcd1234'), 'inv_abcd1234');
  assert.equal(extractStartPayload('/start'), null);
  assert.equal(extractStartPayload('привет'), null);
});
```

(объединить импорт в одну строку: `import { decideAccess, extractInviteCode, extractStartPayload } from './accessDecision';`)

- [ ] **Step 4: Run** `npm test` — Expected: PASS.

- [ ] **Step 5: Проверка** `npx tsc --noEmit -p tsconfig.json`. Не коммитить.

---

### Task 8: Знакомство (FSM)

**Files:**
- Create: `src/handlers/onboarding/state.ts`
- Create: `src/handlers/onboarding/index.ts`
- Modify: `src/handlers/activeFlow.ts`

- [ ] **Step 1: `src/handlers/onboarding/state.ts`**

```ts
import { Goal, Sex } from '../../types/profile';

export type OnboardingStep = 'goal' | 'body' | 'sex' | 'tz';

export interface OnboardingSession {
  step: OnboardingStep;
  inviteCode: string | null;
  goal?: Goal;
  heightCm?: number;
  weightKg?: number;
  age?: number;
  sex?: Sex;
  startedAt: number;
}

const sessions = new Map<number, OnboardingSession>();
const STALE_MS = 24 * 60 * 60 * 1000;

export function getOnboarding(userId: number): OnboardingSession | undefined {
  return sessions.get(userId);
}

export function isOnboarding(userId: number): boolean {
  return sessions.has(userId);
}

export function startOnboardingSession(userId: number, inviteCode: string | null): OnboardingSession {
  const s: OnboardingSession = { step: 'goal', inviteCode, startedAt: Date.now() };
  sessions.set(userId, s);
  return s;
}

export function clearOnboarding(userId: number): void {
  sessions.delete(userId);
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, s] of sessions) if (now - s.startedAt > STALE_MS) sessions.delete(userId);
}, 60 * 60 * 1000).unref();
```

- [ ] **Step 2: Поток `onboarding` в `src/handlers/activeFlow.ts`**

Добавить импорт, тип, сообщение и проверку:

```ts
import { isOnboarding } from './onboarding/state';

export type ActiveFlow = 'draft' | 'edit' | 'settings' | 'onboarding';
```

в `FLOW_MESSAGES`:

```ts
  onboarding: '⚠️ Сначала закончим знакомство — ответь на вопрос выше или отправь /start.',
```

в `otherActiveFlow` перед `return null;`:

```ts
  if (exclude !== 'onboarding' && isOnboarding(userId)) return 'onboarding';
```

- [ ] **Step 3: `src/handlers/onboarding/index.ts`**

```ts
import { Context, Markup, Telegraf } from 'telegraf';
import { config } from '../../config';
import { Goal, GOAL_LABELS, Sex, SEX_LABELS } from '../../types/profile';
import { RU_TIMEZONES, isKnownTimezone, tzLabel } from '../../utils/timezones';
import { parseBodyLine } from '../../utils/parse';
import { waterNormMl, formatLiters } from '../../utils/norms';
import { createProfileWithInvite } from '../../db/profiles';
import { upsertModules } from '../../db/modules';
import { initialModuleRows } from '../../modules/registry';
import { getSettings } from '../../db/settings';
import { extractInviteCode } from '../accessDecision';
import { sendToday } from '../today';
import {
  OnboardingSession,
  clearOnboarding,
  getOnboarding,
  isOnboarding,
  startOnboardingSession,
} from './state';

const INVALID_INVITE_TEXT = 'Ссылка недействительна или уже использована. Попроси новую у того, кто тебя пригласил.';

function goalKeyboard() {
  return Markup.inlineKeyboard(
    (Object.keys(GOAL_LABELS) as Goal[]).map((g) => [Markup.button.callback(GOAL_LABELS[g], `ob:goal:${g}`)])
  ).reply_markup;
}

function sexKeyboard() {
  return Markup.inlineKeyboard([
    (Object.keys(SEX_LABELS) as Sex[]).map((s) => Markup.button.callback(SEX_LABELS[s], `ob:sex:${s}`)),
  ]).reply_markup;
}

export function timezoneKeyboard(prefix: string) {
  const buttons = RU_TIMEZONES.map((t) => Markup.button.callback(`${t.label} · ${t.city}`, `${prefix}${t.iana}`));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return Markup.inlineKeyboard(rows).reply_markup;
}

async function sendStep(ctx: Context, s: OnboardingSession): Promise<void> {
  switch (s.step) {
    case 'goal':
      await ctx.reply('Привет! Я дневник тренировок и тела.\n\n1/4 · Какая у тебя цель?', {
        reply_markup: goalKeyboard(),
      });
      return;
    case 'body':
      await ctx.reply('2/4 · Рост, вес и возраст через пробел.\nНапример: 182 95 34');
      return;
    case 'sex':
      await ctx.reply('3/4 · Пол?', { reply_markup: sexKeyboard() });
      return;
    case 'tz':
      await ctx.reply('4/4 · Твой часовой пояс? Нужен, чтобы напоминания приходили вовремя.', {
        reply_markup: timezoneKeyboard('ob:tz:'),
      });
      return;
  }
}

// Вызывается middleware доступа для пользователя без профиля, которому решено
// «onboard». Сам решает: начать знакомство, продолжить или передать апдейт дальше
// (в ob:-кнопки и текстовый обработчик знакомства).
export async function handleUnprofiledUpdate(
  ctx: Context,
  next: () => Promise<void>,
  startPayload: string | null
): Promise<void> {
  const userId = ctx.from!.id;
  const inviteCode = extractInviteCode(startPayload);
  const cbData = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;

  if (!isOnboarding(userId)) {
    const s = startOnboardingSession(userId, inviteCode);
    if (cbData) await ctx.answerCbQuery();
    await sendStep(ctx, s);
    return;
  }

  const s = getOnboarding(userId)!;
  if (inviteCode && !s.inviteCode) s.inviteCode = inviteCode;

  if (cbData?.startsWith('ob:')) return next();
  if (text !== undefined && !text.startsWith('/')) return next();

  if (cbData) {
    await ctx.answerCbQuery('Сначала закончим знакомство');
    return;
  }
  // /start во время знакомства — просто продолжить с текущего шага.
  if (!text?.startsWith('/start')) await ctx.reply('Сначала закончим знакомство 👇');
  await sendStep(ctx, s);
}

async function finish(ctx: Context, userId: number, s: OnboardingSession, timezone: string): Promise<void> {
  const isOwner = userId === config.OWNER_ID;
  if (!isOwner && !s.inviteCode) {
    clearOnboarding(userId);
    await ctx.reply(INVALID_INVITE_TEXT);
    return;
  }

  const birthYear = new Date().getFullYear() - s.age!;
  const result = await createProfileWithInvite({
    userId,
    inviteCode: isOwner ? null : s.inviteCode,
    goal: s.goal!,
    sex: s.sex!,
    birthYear,
    heightCm: s.heightCm!,
    timezone,
    weightKg: s.weightKg!,
  });
  clearOnboarding(userId);

  if (result === 'invite_invalid') {
    await ctx.reply(INVALID_INVITE_TEXT);
    return;
  }

  const waterMl = waterNormMl({ heightCm: s.heightCm!, weightKg: s.weightKg! });
  if (result === 'created') {
    await upsertModules(initialModuleRows(userId, s.goal!, { water: { dailyMl: waterMl } }));
  }

  const settings = await getSettings(userId);
  await ctx.reply(
    `Готово! Профиль создан.\n\n` +
      `🎯 Цель: ${GOAL_LABELS[s.goal!]}\n` +
      `🕒 Часовой пояс: ${tzLabel(timezone)}\n` +
      `🏋️ Цель недели: ${settings.week_goal} тренировки\n` +
      `💧 Норма воды: ${formatLiters(waterMl)} в день — пригодится, когда появится модуль воды\n\n` +
      `Всё меняется в /settings. Главная команда — /today.`
  );
  await sendToday(ctx, userId);
}

export function registerOnboarding(bot: Telegraf): void {
  bot.action(/^ob:goal:(lose|gain|regular)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const s = getOnboarding(ctx.from.id);
    if (!s || s.step !== 'goal') return;
    s.goal = ctx.match[1] as Goal;
    s.step = 'body';
    await ctx.editMessageText(`1/4 · Цель: ${GOAL_LABELS[s.goal]}`);
    await sendStep(ctx, s);
  });

  bot.action(/^ob:sex:(male|female)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const s = getOnboarding(ctx.from.id);
    if (!s || s.step !== 'sex') return;
    s.sex = ctx.match[1] as Sex;
    s.step = 'tz';
    await ctx.editMessageText(`3/4 · Пол: ${SEX_LABELS[s.sex]}`);
    await sendStep(ctx, s);
  });

  bot.action(/^ob:tz:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const s = getOnboarding(userId);
    const tz = ctx.match[1];
    if (!s || s.step !== 'tz' || !isKnownTimezone(tz)) return;
    await ctx.editMessageText(`4/4 · Часовой пояс: ${tzLabel(tz)}`);
    await finish(ctx, userId, s, tz);
  });

  bot.on('text', async (ctx, next) => {
    const s = getOnboarding(ctx.from.id);
    if (!s) return next();
    if (s.step !== 'body') {
      await sendStep(ctx, s);
      return;
    }
    const parsed = parseBodyLine(ctx.message.text);
    if (!parsed.ok) {
      await ctx.reply(parsed.error);
      return;
    }
    s.heightCm = parsed.heightCm;
    s.weightKg = parsed.weightKg;
    s.age = parsed.age;
    s.step = 'sex';
    await sendStep(ctx, s);
  });
}
```

- [ ] **Step 4: Проверка** `npx tsc --noEmit -p tsconfig.json` — ожидаемо падает на `../today` (`sendToday`): модуль появится в задаче 9. Сразу перейти к задаче 9 и проверить после неё.

---

### Task 9: `/today`

**Files:**
- Modify: `src/db/workouts.ts` (дописать функцию)
- Create: `src/handlers/today.ts`
- Modify: `src/handlers/workout/index.ts` (только `export` у `handleNewWorkoutCommand`)

- [ ] **Step 1: `countWorkoutsSince` в конец `src/db/workouts.ts`**

```ts
export async function countWorkoutsSince(userId: number, sinceIso: string): Promise<number> {
  const { count, error } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('date', sinceIso);

  if (error) throw new Error(`countWorkoutsSince: ${error.message}`);
  return count ?? 0;
}
```

- [ ] **Step 2: Экспортировать вход в новую тренировку**

В `src/handlers/workout/index.ts` заменить `async function handleNewWorkoutCommand(` на `export async function handleNewWorkoutCommand(`. Больше в этом файле в этой задаче ничего не менять (файл параллельно правит другой процесс).

- [ ] **Step 3: `src/handlers/today.ts`**

```ts
import { Context, Markup, Telegraf } from 'telegraf';
import { getRecentWorkouts, countWorkoutsSince } from '../db/workouts';
import { getSettings } from '../db/settings';
import { getModules } from '../db/modules';
import { getUserTimezone } from '../db/profiles';
import { availableModules } from '../modules/registry';
import { localNow, localWeekStart, localMidnightUtc, daysBetween } from '../utils/time';
import { resolveWebAppUrl } from './webapp';
import { handleNewWorkoutCommand } from './workout';
import { WorkoutType } from '../types/domain';

const TYPE_LABELS: Record<WorkoutType, string> = {
  strength: 'силовая',
  cardio: 'кардио',
  pool: 'бассейн',
  mixed: 'смешанная',
};

function relativeDay(days: number): string {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days === 2) return 'позавчера';
  return `${days} дн. назад`;
}

async function workoutsBlock(userId: number, tz: string, todayStr: string): Promise<string> {
  const [last] = await getRecentWorkouts(userId, 1, 0);
  const weekStart = localMidnightUtc(localWeekStart(tz), tz).toISOString();
  const [weekCount, settings] = await Promise.all([countWorkoutsSince(userId, weekStart), getSettings(userId)]);

  const weekLine = `   Неделя: ${weekCount} / ${settings.week_goal}`;
  if (!last) return `🏋️ Тренировок пока нет\n${weekLine}`;

  const lastDay = localNow(tz, new Date(last.date)).dateStr;
  const ago = daysBetween(lastDay, todayStr);
  if (ago === 0) return `🏋️ Сегодня: ${TYPE_LABELS[last.type]} ✓\n${weekLine}`;
  return `🏋️ Сегодня тренировки не было\n   Последняя: ${relativeDay(ago)} · ${TYPE_LABELS[last.type]}\n${weekLine}`;
}

export async function buildToday(userId: number): Promise<string> {
  const tz = await getUserTimezone(userId);
  const now = new Date();
  const { dateStr } = localNow(tz, now);
  const header = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  const blocks = [await workoutsBlock(userId, tz, dateStr)];

  const modules = availableModules();
  if (modules.length > 0) {
    const rows = await getModules(userId);
    for (const m of modules) {
      if (!m.todaySection || !rows.find((r) => r.module === m.id && r.enabled)) continue;
      const section = await m.todaySection(userId, { tz, todayStr: dateStr });
      if (section) blocks.push(section);
    }
  }

  return `Сегодня, ${header}\n\n${blocks.join('\n\n')}`;
}

function todayKeyboard() {
  const url = resolveWebAppUrl();
  const row = [Markup.button.callback('🏋️ Записать тренировку', 't:new_workout')];
  if (url) return Markup.inlineKeyboard([row, [Markup.button.webApp('📊 Дневник', url)]]).reply_markup;
  return Markup.inlineKeyboard([row]).reply_markup;
}

export async function sendToday(ctx: Context, userId: number): Promise<void> {
  await ctx.reply(await buildToday(userId), { reply_markup: todayKeyboard() });
}

export function registerToday(bot: Telegraf): void {
  bot.command('today', async (ctx) => {
    await sendToday(ctx, ctx.from.id);
  });

  bot.action('t:new_workout', async (ctx) => {
    await ctx.answerCbQuery();
    await handleNewWorkoutCommand(ctx);
  });
}
```

- [ ] **Step 4: Проверка** `npx tsc --noEmit -p tsconfig.json` (теперь проходят и задачи 8, и 9) и `npm test`. Не коммитить.

---

### Task 10: Middleware доступа, `/invite`, порядок регистрации, `/start`, команды

**Files:**
- Create: `src/handlers/access.ts`
- Modify: `src/botInstance.ts`
- Modify: `src/handlers/start.ts`
- Modify: `src/handlers/webapp.ts`

- [ ] **Step 1: `src/handlers/access.ts`**

```ts
import { Context, Telegraf } from 'telegraf';
import { config } from '../config';
import { getProfileCached } from '../db/profiles';
import { createInvite } from '../db/invites';
import { decideAccess, extractStartPayload } from './accessDecision';
import { isOnboarding } from './onboarding/state';
import { handleUnprofiledUpdate } from './onboarding';

const DENY_TEXT =
  'Доступ по приглашению. Попроси ссылку у того, кто рассказал тебе о боте.\n' +
  'Если ты уже начинал знакомство — открой ссылку-приглашение ещё раз.';

async function deny(ctx: Context): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery('Доступ по приглашению');
    return;
  }
  if (ctx.message) await ctx.reply(DENY_TEXT);
}

export function registerAccess(bot: Telegraf): void {
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const profile = await getProfileCached(userId);
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    const startPayload = extractStartPayload(text);

    const decision = decideAccess({
      isOwner: userId === config.OWNER_ID,
      hasProfile: profile !== null,
      onboardingInProgress: isOnboarding(userId),
      startPayload,
    });

    if (decision === 'allow') return next();
    if (decision === 'deny') return deny(ctx);
    return handleUnprofiledUpdate(ctx, next, startPayload);
  });

  bot.command('invite', async (ctx) => {
    if (ctx.from.id !== config.OWNER_ID) return;
    const code = await createInvite(ctx.from.id);
    await ctx.reply(
      `Ссылка-приглашение (одноразовая):\nhttps://t.me/${ctx.botInfo.username}?start=inv_${code}\n\n` +
        'Отправь её другу — по ней он пройдёт знакомство с ботом.'
    );
  });
}
```

- [ ] **Step 2: `src/botInstance.ts` — порядок и регистрация**

Заменить блок импортов и регистраций:

```ts
import { Telegraf } from 'telegraf';
import { config } from './config';
import { registerAccess } from './handlers/access';
import { registerOnboarding } from './handlers/onboarding';
import { registerStart } from './handlers/start';
import { registerToday } from './handlers/today';
import { registerHistory } from './handlers/history';
import { registerProgress } from './handlers/progress';
import { registerExport } from './handlers/export';
import { registerWorkout } from './handlers/workout';
import { registerWorkoutEdit } from './handlers/workout/editStep';
import { registerSettings } from './handlers/settings';
import { registerWebApp } from './handlers/webapp';

export const bot = new Telegraf(config.BOT_TOKEN);

// Порядок важен: доступ — первым, затем знакомство (его текстовый обработчик
// должен видеть текст раньше остальных FSM).
registerAccess(bot);
registerOnboarding(bot);
registerStart(bot);
registerToday(bot);
registerWorkout(bot);
registerWorkoutEdit(bot);
registerHistory(bot);
registerProgress(bot);
registerExport(bot);
registerSettings(bot);
registerWebApp(bot);
```

(`bot.catch` меняется в задаче 13.)

- [ ] **Step 3: `src/handlers/start.ts`**

Полностью заменить содержимое:

```ts
import { Telegraf } from 'telegraf';
import { sendToday } from './today';

const HELP_TEXT = `Команды:
/today — сегодня: что сделано и что осталось
/new_workout — начать новую тренировку
/done — завершить и сохранить текущую тренировку
/history — последние тренировки
/progress <упражнение> — история весов/повторений по упражнению
/export — вся история в markdown (удобно вставить в чат с LLM)
/settings — профиль, напоминания, цель недели
/app — открыть дневник (Mini App)`;

// Сюда доходят только пользователи с профилем: остальных перехватывает
// middleware доступа (src/handlers/access.ts) и знакомство.
export function registerStart(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    await ctx.reply(HELP_TEXT);
    await sendToday(ctx, ctx.from.id);
  });
}
```

- [ ] **Step 4: Команды бота в `src/handlers/webapp.ts`**

В `setupBotCommands` заменить массив:

```ts
    await bot.telegram.setMyCommands([
      { command: 'today', description: 'Сегодня' },
      { command: 'new_workout', description: 'Новая тренировка' },
      { command: 'done', description: 'Завершить и сохранить тренировку' },
      { command: 'history', description: 'История тренировок' },
      { command: 'progress', description: 'Прогресс по упражнению' },
      { command: 'app', description: 'Открыть дневник (Mini App)' },
      { command: 'settings', description: 'Профиль и настройки' },
      { command: 'export', description: 'Экспорт истории в markdown' },
    ]);
```

- [ ] **Step 5: Проверка** `npx tsc --noEmit -p tsconfig.json` и `npm test`. Не коммитить.

---

### Task 11: Напоминания и недели по поясу пользователя

**Files:**
- Modify: `src/db/settings.ts`
- Modify: `src/cron/reminders.ts`
- Modify: `src/webapp/queries.ts`

- [ ] **Step 1: `src/db/settings.ts`** — удалить `getUsersNeedingReminder` целиком (и импорт `getRecentWorkouts`, если он больше не нужен), добавить:

```ts
export async function getEnabledReminderSettings(): Promise<
  Pick<UserSettings, 'user_id' | 'reminder_time' | 'last_reminder_sent_date'>[]
> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id, reminder_time, last_reminder_sent_date')
    .eq('reminders_enabled', true)
    .not('reminder_time', 'is', null);

  if (error) throw new Error(`getEnabledReminderSettings: ${error.message}`);
  return (data ?? []) as Pick<UserSettings, 'user_id' | 'reminder_time' | 'last_reminder_sent_date'>[];
}
```

- [ ] **Step 2: `src/cron/reminders.ts`** — полностью заменить:

```ts
import cron from 'node-cron';
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

// Каждую реальную минуту: для каждого пользователя с включёнными напоминаниями
// сравниваем ЕГО местное время с reminder_time (пояс — из profiles.timezone).
export function startReminderCron(bot: Telegraf): void {
  let isRunning = false;

  cron.schedule('* * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const rows = await getEnabledReminderSettings();
      if (rows.length === 0) return;
      const tzMap = await getTimezones(rows.map((r) => r.user_id));
      const now = new Date();

      for (const row of rows) {
        const { hhmm, dateStr } = localNow(tzMap.get(row.user_id) ?? DEFAULT_TZ, now);
        if (row.reminder_time !== hhmm || row.last_reminder_sent_date === dateStr) continue;
        try {
          if ((await daysSinceLastWorkout(row.user_id)) < MIN_DAYS_SINCE_LAST_WORKOUT) continue;
          await bot.telegram.sendMessage(row.user_id, REMINDER_TEXT);
          await upsertSettings(row.user_id, { last_reminder_sent_date: dateStr });
        } catch (err) {
          console.error(`Не удалось отправить напоминание userId=${row.user_id}:`, err);
        }
      }
    } catch (err) {
      console.error('Ошибка в reminder cron job:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('Reminder cron job запущен (пояс каждого пользователя, проверка каждую минуту)');
}
```

- [ ] **Step 3: `src/webapp/queries.ts`** — недели по поясу.

Добавить импорты:

```ts
import { getUserTimezone } from '../db/profiles';
import { addDays, localMidnightUtc, localWeekStart, weekStartOf } from '../utils/time';
```

Заменить `getSummary` и всё ниже до конца файла (`weekVolume` не меняется — оставить):

```ts
export async function getSummary(userId: number): Promise<SummaryResponse> {
  const tz = await getUserTimezone(userId);
  const { data: workoutRows, error } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw new Error(`getSummary/workouts: ${error.message}`);

  const rows = (workoutRows ?? []) as { id: string; date: string }[];
  const totalWorkouts = rows.length;

  const weekKeys = new Set(rows.map((r) => weekStartOf(new Date(r.date), tz)));
  const thisWeekKey = localWeekStart(tz);
  const weekStreak = computeWeekStreak(weekKeys, thisWeekKey);

  const thisWeekIds = rows.filter((r) => weekStartOf(new Date(r.date), tz) === thisWeekKey).map((r) => r.id);
  const weekWorkouts = thisWeekIds.length;
  const [weekVolumeKg, settings] = await Promise.all([weekVolume(thisWeekIds), getSettings(userId)]);

  return { totalWorkouts, weekStreak, weekVolumeKg, weekWorkouts, weekGoal: settings.week_goal };
}
```

(функция `weekVolume` остаётся как есть)

```ts
function computeWeekStreak(weekKeys: Set<string>, thisWeekKey: string): number {
  if (weekKeys.size === 0) return 0;

  let cursor = thisWeekKey;
  // Льгота: если на текущей неделе ещё не тренировался, считаем от прошлой недели.
  if (!weekKeys.has(cursor)) cursor = addDays(cursor, -7);

  let streak = 0;
  while (weekKeys.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

// --- История тоннажа по неделям для графика на «Прогрессе» (zero-fill) ---
export async function getVolumeHistory(userId: number, weeks = 12): Promise<VolumeHistoryPoint[]> {
  const tz = await getUserTimezone(userId);
  const weekStarts = lastMondays(weeks, localWeekStart(tz)); // по возрастанию
  const earliestIso = localMidnightUtc(weekStarts[0], tz).toISOString();

  const { data, error } = await supabase
    .from('exercises')
    .select('sets, workouts!inner(user_id, date)')
    .eq('workouts.user_id', userId)
    .gte('workouts.date', earliestIso)
    .order('date', { foreignTable: 'workouts', ascending: true });
  if (error) throw new Error(`getVolumeHistory: ${error.message}`);

  const totals = new Map<string, number>(weekStarts.map((w) => [w, 0]));
  for (const row of (data ?? []) as unknown as {
    sets: SetEntry[];
    workouts: { date: string } | { date: string }[];
  }[]) {
    const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
    if (!workout?.date) continue;
    const key = weekStartOf(new Date(workout.date), tz);
    if (!totals.has(key)) continue; // защита от пограничных строк вне запрошенного окна
    const volume = (row.sets ?? []).reduce((sum, s) => sum + s.weight * s.reps, 0);
    totals.set(key, (totals.get(key) ?? 0) + volume);
  }

  return weekStarts.map((weekStart) => ({ weekStart, volumeKg: Math.round(totals.get(weekStart) ?? 0) }));
}

// Понедельники последних `weeks` недель включительно текущей, по возрастанию дат.
function lastMondays(weeks: number, thisWeekKey: string): string[] {
  const result: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) result.push(addDays(thisWeekKey, -7 * i));
  return result;
}
```

Функция `mondayKey` удаляется (больше не используется). Проверить grep'ом: `mondayKey` не должен встречаться в `src/`.

- [ ] **Step 4: Проверка** `npx tsc --noEmit -p tsconfig.json` и `npm test`. Не коммитить.

---

### Task 12: `/settings` по разделам и раздел «Профиль»

**Files:**
- Modify: `src/handlers/settingsState.ts`
- Create: `src/handlers/settingsProfile.ts`
- Modify: `src/handlers/settings.ts`

- [ ] **Step 1: Ожидание ввода «рост вес возраст» в `src/handlers/settingsState.ts`**

Заменить содержимое:

```ts
// Состояние ожидания текстового ввода в /settings — отдельно от settings.ts,
// чтобы activeFlow.ts мог проверять его без циклического импорта хендлера.
type AwaitedInput = 'time' | 'goal' | 'body';
const awaiting = new Map<number, AwaitedInput>();

export function isWaitingForTime(userId: number): boolean {
  return awaiting.get(userId) === 'time';
}

export function isWaitingForGoal(userId: number): boolean {
  return awaiting.get(userId) === 'goal';
}

export function isWaitingForBody(userId: number): boolean {
  return awaiting.get(userId) === 'body';
}

export function isAwaitingSettingsInput(userId: number): boolean {
  return awaiting.has(userId);
}

export function setWaitingForTime(userId: number): void {
  awaiting.set(userId, 'time');
}

export function setWaitingForGoal(userId: number): void {
  awaiting.set(userId, 'goal');
}

export function setWaitingForBody(userId: number): void {
  awaiting.set(userId, 'body');
}

export function clearAwaitingSettingsInput(userId: number): void {
  awaiting.delete(userId);
}
```

- [ ] **Step 2: `src/handlers/settingsProfile.ts`**

```ts
import { Context, Markup, Telegraf } from 'telegraf';
import { Goal, GOAL_LABELS, Profile, Sex, SEX_LABELS } from '../types/profile';
import { addBodyWeight, getLatestWeight, getProfile, updateProfile } from '../db/profiles';
import { getModules, patchModuleSettings } from '../db/modules';
import { isKnownTimezone, tzLabel } from '../utils/timezones';
import { parseBodyLine } from '../utils/parse';
import { formatLiters, waterNormMl } from '../utils/norms';
import { otherActiveFlow, activeFlowBlockedMessage } from './activeFlow';
import { clearAwaitingSettingsInput, isWaitingForBody, setWaitingForBody } from './settingsState';
import { timezoneKeyboard } from './onboarding';

async function profileText(p: Profile): Promise<string> {
  const weight = await getLatestWeight(p.user_id);
  const age = new Date().getFullYear() - p.birth_year;
  return (
    `👤 Профиль\n\n` +
    `Цель: ${GOAL_LABELS[p.goal]}\n` +
    `Рост: ${p.height_cm} см · Вес: ${weight ?? '—'} кг · Возраст: ${age}\n` +
    `Пол: ${SEX_LABELS[p.sex]}\n` +
    `Часовой пояс: ${tzLabel(p.timezone)}`
  );
}

function profileKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎯 Цель', 's:p:goal'), Markup.button.callback('📏 Рост, вес, возраст', 's:p:body')],
    [Markup.button.callback('🚻 Пол', 's:p:sex'), Markup.button.callback('🕒 Часовой пояс', 's:p:tz')],
    [Markup.button.callback('⬅️ Назад', 's:menu')],
  ]).reply_markup;
}

async function showProfile(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const p = await getProfile(userId);
  if (!p) return;
  const text = await profileText(p);
  if (viaEdit) await ctx.editMessageText(text, { reply_markup: profileKeyboard() });
  else await ctx.reply(text, { reply_markup: profileKeyboard() });
}

export function registerSettingsProfile(bot: Telegraf): void {
  bot.action('s:profile', async (ctx) => {
    await ctx.answerCbQuery();
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.action('s:p:goal', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Новая цель?', {
      reply_markup: Markup.inlineKeyboard([
        ...(Object.keys(GOAL_LABELS) as Goal[]).map((g) => [Markup.button.callback(GOAL_LABELS[g], `s:p:goal:${g}`)]),
        [Markup.button.callback('⬅️ Назад', 's:profile')],
      ]).reply_markup,
    });
  });

  bot.action(/^s:p:goal:(lose|gain|regular)$/, async (ctx) => {
    await ctx.answerCbQuery('Цель обновлена');
    await updateProfile(ctx.from.id, { goal: ctx.match[1] as Goal });
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.action('s:p:sex', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Пол?', {
      reply_markup: Markup.inlineKeyboard([
        (Object.keys(SEX_LABELS) as Sex[]).map((s) => Markup.button.callback(SEX_LABELS[s], `s:p:sex:${s}`)),
        [Markup.button.callback('⬅️ Назад', 's:profile')],
      ]).reply_markup,
    });
  });

  bot.action(/^s:p:sex:(male|female)$/, async (ctx) => {
    await ctx.answerCbQuery('Сохранено');
    await updateProfile(ctx.from.id, { sex: ctx.match[1] as Sex });
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.action('s:p:tz', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Твой часовой пояс?', { reply_markup: timezoneKeyboard('s:p:tz:') });
  });

  bot.action(/^s:p:tz:(.+)$/, async (ctx) => {
    const tz = ctx.match[1];
    if (!isKnownTimezone(tz)) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery('Часовой пояс обновлён');
    await updateProfile(ctx.from.id, { timezone: tz });
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.action('s:p:body', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const conflict = otherActiveFlow(userId, 'settings');
    if (conflict) {
      await ctx.reply(activeFlowBlockedMessage(conflict));
      return;
    }
    setWaitingForBody(userId);
    await ctx.reply('Напиши рост, вес и возраст через пробел, например: 182 95 34');
  });

  bot.action(/^s:p:water:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Норма обновлена');
    await patchModuleSettings(ctx.from.id, 'water', { dailyMl: Number(ctx.match[1]) });
    await showProfile(ctx, ctx.from.id, true);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    if (!isWaitingForBody(userId)) return next();

    const parsed = parseBodyLine(ctx.message.text);
    if (!parsed.ok) {
      await ctx.reply(parsed.error);
      return;
    }
    clearAwaitingSettingsInput(userId);

    await updateProfile(userId, { height_cm: parsed.heightCm, birth_year: new Date().getFullYear() - parsed.age });
    await addBodyWeight(userId, parsed.weightKg);

    const rows = await getModules(userId);
    const currentMl = Number(rows.find((r) => r.module === 'water')?.settings.dailyMl ?? 0);
    const newMl = waterNormMl({ heightCm: parsed.heightCm, weightKg: parsed.weightKg });

    if (currentMl !== newMl) {
      await ctx.reply(
        `✅ Сохранено.\n\nПересчитать норму воды? Сейчас ${currentMl ? formatLiters(currentMl) : 'не задана'}, по новым данным — ${formatLiters(newMl)}.`,
        {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да, пересчитать', `s:p:water:${newMl}`)],
            [Markup.button.callback('Нет, оставить', 's:profile')],
          ]).reply_markup,
        }
      );
      return;
    }
    await ctx.reply('✅ Сохранено.');
    await showProfile(ctx, userId, false);
  });
}
```

- [ ] **Step 3: `src/handlers/settings.ts` — меню разделов и пояс вместо «Europe/Moscow»**

Изменения:

1) Импорты: добавить

```ts
import { Context } from 'telegraf';
import { getUserTimezone } from '../db/profiles';
import { tzLabel } from '../utils/timezones';
import { registerSettingsProfile } from './settingsProfile';
```

(`Context` объединить с существующим импортом из `telegraf`: `import { Telegraf, Markup, Context } from 'telegraf';`)

2) `settingsText` принимает пояс:

```ts
function settingsText(s: UserSettings, tz: string): string {
  const status = s.reminders_enabled ? 'включены' : 'выключены';
  const time = s.reminder_time ?? 'не задано';
  const goalWord = pluralizeRu(s.week_goal, ['тренировка', 'тренировки', 'тренировок']);
  return `🏋️ Тренировки\n\nНапоминания: ${status}\nВремя проверки: ${time} (${tzLabel(tz)})\nЦель недели: ${s.week_goal} ${goalWord}`;
}
```

3) В `settingsKeyboard` последней строкой добавить `[Markup.button.callback('⬅️ Назад', 's:menu')],`.

4) Новые функции меню (над `registerSettings`):

```ts
function menuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👤 Профиль', 's:profile')],
    [Markup.button.callback('🏋️ Тренировки', 's:workouts')],
  ]).reply_markup;
}

const MENU_TEXT = '⚙️ Настройки';

async function showWorkoutSettings(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const [settings, tz] = await Promise.all([getSettings(userId), getUserTimezone(userId)]);
  const opts = { reply_markup: settingsKeyboard(settings) };
  if (viaEdit) await ctx.editMessageText(settingsText(settings, tz), opts);
  else await ctx.reply(settingsText(settings, tz), opts);
}
```

5) В `registerSettings`:
- первой строкой тела: `registerSettingsProfile(bot);`
- обработчик `/settings`:

```ts
  bot.command('settings', async (ctx) => {
    clearAwaitingSettingsInput(ctx.from.id);
    await ctx.reply(MENU_TEXT, { reply_markup: menuKeyboard() });
  });

  bot.action('s:menu', async (ctx) => {
    await ctx.answerCbQuery();
    clearAwaitingSettingsInput(ctx.from.id);
    await ctx.editMessageText(MENU_TEXT, { reply_markup: menuKeyboard() });
  });

  bot.action('s:workouts', async (ctx) => {
    await ctx.answerCbQuery();
    await showWorkoutSettings(ctx, ctx.from.id, true);
  });
```

- в `s:reminders:on` и `s:reminders:off` заменить `editMessageText(settingsText(settings), ...)` на `await showWorkoutSettings(ctx, userId, true);` после `upsertSettings` (результат `upsertSettings` больше не нужен — `await upsertSettings(...)` без присваивания);
- в `s:time` текст: `'Напиши время в формате ЧЧ:ММ (например, 19:30). Время — по твоему часовому поясу из профиля.'`;
- в текстовом обработчике ответ после сохранения времени: заменить на

```ts
    clearAwaitingSettingsInput(userId);
    await upsertSettings(userId, { reminder_time: text });
    await ctx.reply(`✅ Готово! Время обновлено: ${text}.`);
    await showWorkoutSettings(ctx, userId, false);
```

- аналогично для цели недели:

```ts
      clearAwaitingSettingsInput(userId);
      await upsertSettings(userId, { week_goal: n });
      const goalWord = pluralizeRu(n, ['тренировка', 'тренировки', 'тренировок']);
      await ctx.reply(`✅ Готово! Цель недели: ${n} ${goalWord}.`);
      await showWorkoutSettings(ctx, userId, false);
      return;
```

Проверить grep'ом: `Europe/Moscow` не встречается в `src/handlers/`.

- [ ] **Step 4: Проверка** `npx tsc --noEmit -p tsconfig.json` и `npm test`. Не коммитить.

---

### Task 13: Mini App 403 без профиля и общий обработчик ошибок

**Files:**
- Modify: `src/webapp/server.ts`
- Modify: `src/botInstance.ts`

- [ ] **Step 1: `src/webapp/server.ts`** — импорт и проверка профиля сразу после успешной аутентификации в `handleApi` (после блока `try { user = authOrThrow(req); } catch ...`):

```ts
import { getProfileCached } from '../db/profiles';
```

```ts
  const profile = await getProfileCached(user.userId).catch(() => null);
  if (!profile) {
    sendJson(res, 403, { error: 'Нет доступа. Сначала пройди знакомство в боте.' });
    return;
  }
```

- [ ] **Step 2: `src/botInstance.ts`** — заменить `bot.catch`:

```ts
const FAILURE_TEXT = '⚠️ Не получилось выполнить действие — сервис может быть временно недоступен. Попробуй через пару минут.';

bot.catch(async (err, ctx) => {
  console.error(`Ошибка обработки апдейта ${ctx.updateType}:`, err);
  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Ошибка, попробуй позже');
    if (ctx.chat) await ctx.reply(FAILURE_TEXT);
  } catch {
    // Telegram тоже недоступен — остаётся только лог.
  }
});
```

- [ ] **Step 3: Проверка** `npx tsc --noEmit -p tsconfig.json` и `npm test`. Не коммитить.

---

### Task 14: Тренировка задним числом

**Files:**
- Modify: `src/types/draft.ts`
- Modify: `src/handlers/workout/keyboards.ts`
- Modify: `src/handlers/workout/index.ts`
- Modify: `src/handlers/workout/finish.ts`

- [ ] **Step 0: Проверить параллельные правки**

Run: `git status --short src/handlers/workout src/types/draft.ts` и `git diff src/handlers/workout src/types/draft.ts`
Прочитать актуальные версии `keyboards.ts`, `index.ts`, `finish.ts`, `draft.ts` перед правками. Если реализация повтора уже добавила новые шаги или callback'и — встраиваться рядом, не удаляя их.

- [ ] **Step 1: `src/types/draft.ts`**

В `WorkoutStep` добавить вариант `| 'choosing_date'`. В `DraftWorkout` добавить поле:

```ts
  date?: string; // YYYY-MM-DD, местная дата пользователя; нет — «сейчас»
```

- [ ] **Step 2: `src/handlers/workout/keyboards.ts`**

В `typeKeyboard()` добавить последней строкой кнопку `Markup.button.callback('📅 Другая дата', 'w:date')` (отдельный ряд, в том же стиле построения, что и остальные ряды функции). Добавить новую клавиатуру:

```ts
export function dateKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Сегодня', 'w:date:0')],
    [Markup.button.callback('Вчера', 'w:date:1'), Markup.button.callback('Позавчера', 'w:date:2')],
    [Markup.button.callback('❌ Отменить тренировку', 'w:cancel_workout')],
  ]).reply_markup;
}
```

(если `Markup` не импортирован в файле — добавить `import { Markup } from 'telegraf';`, сверившись с тем, как файл строит остальные клавиатуры)

- [ ] **Step 3: `src/handlers/workout/index.ts`**

Импорты:

```ts
import { getUserTimezone } from '../../db/profiles';
import { addDays, localNow } from '../../utils/time';
import { parseDayMonth } from '../../utils/parse';
```

и `dateKeyboard` в импорт из `./keyboards`.

Хелперы (над `registerWorkout`):

```ts
const DATE_PROMPT = '📅 За какой день записать тренировку? Выбери кнопкой или напиши дату дд.мм:';

function typePromptText(date?: string): string {
  if (!date) return 'Выбери тип тренировки:';
  const [, m, d] = date.split('-');
  return `📅 ${d}.${m} · Выбери тип тренировки:`;
}

async function applyChosenDate(ctx: Context, userId: number, dateStr: string | undefined, viaEdit: boolean): Promise<void> {
  const draft = getDraft(userId);
  if (!draft) return;
  draft.date = dateStr;
  draft.step = 'choosing_type';
  const text = typePromptText(dateStr);
  if (viaEdit) await ctx.editMessageText(text, { reply_markup: typeKeyboard() });
  else await ctx.reply(text, { reply_markup: typeKeyboard() });
}
```

В `renderCurrentStep` заменить ветку `choosing_type` на использование даты и добавить `choosing_date`:

```ts
    case 'choosing_type':
      await ctx.editMessageText(typePromptText(draft.date), { reply_markup: typeKeyboard() });
      return;
    case 'choosing_date':
      await ctx.editMessageText(DATE_PROMPT, { reply_markup: dateKeyboard() });
      return;
```

В `registerWorkout` добавить обработчики (рядом с `w:type:`):

```ts
  bot.action('w:date', async (ctx) => {
    await ctx.answerCbQuery();
    const draft = getDraft(ctx.from.id);
    if (!draft) return;
    draft.step = 'choosing_date';
    await ctx.editMessageText(DATE_PROMPT, { reply_markup: dateKeyboard() });
  });

  bot.action(/^w:date:([0-2])$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const back = Number(ctx.match[1]);
    const today = localNow(await getUserTimezone(userId)).dateStr;
    await applyChosenDate(ctx, userId, back === 0 ? undefined : addDays(today, -back), true);
  });
```

В текстовом обработчике `bot.on('text', ...)` перед `if (draft.step === 'entering_warmup')` добавить:

```ts
    if (draft.step === 'choosing_date') {
      const today = localNow(await getUserTimezone(draft.userId)).dateStr;
      const parsed = parseDayMonth(text, today);
      if (!parsed.ok) {
        await ctx.reply(parsed.error);
        return;
      }
      await applyChosenDate(ctx, draft.userId, parsed.dateStr === today ? undefined : parsed.dateStr, false);
      return;
    }
```

- [ ] **Step 4: `src/handlers/workout/finish.ts`**

Импорты:

```ts
import { getUserTimezone } from '../../db/profiles';
import { localNoonUtc } from '../../utils/time';
```

В `createWorkout({...})` добавить поле `date`:

```ts
  const workout = await createWorkout({
    userId,
    type: draft.type,
    date: draft.date ? localNoonUtc(draft.date, await getUserTimezone(userId)) : undefined,
    durationMinutes: draft.cardio?.durationMinutes,
    warmupMinutes: draft.warmupMinutes,
  });
```

Перед `if (draft.warmupMinutes !== undefined)` в сборке `sections` добавить:

```ts
  if (draft.date) {
    const [, m, d] = draft.date.split('-');
    sections.push(`📅 Дата: ${d}.${m}`);
  }
```

- [ ] **Step 5: Проверка** `npx tsc --noEmit -p tsconfig.json` и `npm test`. Не коммитить.

---

### Task 15: Финальная проверка и выкатка

- [ ] **Step 1: Полная сборка**

Run: `npm run build`
Expected: exit 0 (бот + webapp).

- [ ] **Step 2: Тесты**

Run: `npm test`
Expected: все тесты PASS.

- [ ] **Step 3: Grep-проверки**

- `Europe/Moscow` в `src/` встречается только в `src/utils/time.ts` (`DEFAULT_TZ`) и `src/utils/timezones.ts`;
- `mondayKey` и `getUsersNeedingReminder` в `src/` не встречаются.

- [ ] **Step 4: Передать пользователю шаги выкатки** (сам не пушить и не коммитить):
1. Миграция применена (задача 4, шаг 3) — если ещё нет, применить после его «да».
2. Добавить `OWNER_ID` в Environment сервиса `gym95` на Render **до** пуша, иначе процесс не стартует.
3. Коммит и пуш делает параллельный процесс или пользователь → автодеплой.
4. Ручной чек-лист из раздела 10 спека.
