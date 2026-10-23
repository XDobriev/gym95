# Live Workout в Telegram Mini App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать интерактивный режим Live Workout в Telegram Mini App для ведения силовой тренировки у тренажёра (Workout Hub, карточки упражнений с подсказками ghost values, автотаймер отдыха, сохранение в localStorage и сохранение тренировки в бэкенд).

**Architecture:** 
- **Клиентская часть:** Новая вкладка «⚡ В зал» в `webapp/src/App.tsx` и экран `LiveWorkoutScreen.tsx`. Состояние активной тренировки хранится в React State и зеркалируется в `localStorage` при любом изменении. Логика расчёта тоннажа, подсказок и фильтрации вынесена в чистые функции `webapp/src/utils/liveWorkout.ts`. Плавающий таймер отдыха переиспользует звуки из `sound.ts` и `telegram.ts` haptic.
- **Серверная часть:** Новые эндпоинты в `src/webapp/server.ts` и модуль `src/webapp/live.ts`: `GET /api/live-context` для мгновенной загрузки шаблонов, прошлой тренировки и базы упражнений; `POST /api/workouts` для надёжного сохранения сессии в Supabase с проверкой рекордов 1RM и уведомлением в Telegram-бот.

**Tech Stack:** TypeScript, React, Vite, Node.js HTTP server, Supabase Postgres, Web Audio API, Telegram WebApp API.

---

### Task 1: Типы данных для Live Workout (Shared Types)

**Files:**
- Modify: `webapp/shared/types.ts`

- [x] **Step 1: Добавить типы Live Context и Live Workout в `webapp/shared/types.ts`**
...
- [x] **Step 2: Запустить `npm --prefix webapp run build` для проверки типов**

Run: `npm --prefix webapp run build`
Expected: Успешная компиляция без ошибок.

---

### Task 2: Чистые функции и утилиты Live Workout (TDD)

**Files:**
- Create: `src/utils/liveWorkout.ts`
- Create: `src/utils/liveWorkout.test.ts`
- Create: `webapp/src/utils/liveWorkout.ts`

- [ ] **Step 1: Написать failing unit-тесты для утилит Live Workout**

Создать `src/utils/liveWorkout.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSessionVolume,
  filterCompletedExercises,
  getGhostValues,
  calculateLive1RM,
} from './liveWorkout';

test('calculateSessionVolume: суммирует только завершённые подходы', () => {
  const exercises = [
    {
      name: 'Жим лёжа',
      sets: [
        { weight: 80, reps: 10, completed: true },
        { weight: 85, reps: 8, completed: true },
        { weight: 90, reps: 6, completed: false }, // не завершён
      ],
    },
    {
      name: 'Подтягивания',
      sets: [
        { weight: 0, reps: 10, completed: true },
      ],
    },
  ];

  const volume = calculateSessionVolume(exercises);
  // (80*10) + (85*8) + (0*10) = 800 + 680 = 1480
  assert.equal(volume, 1480);
});

test('filterCompletedExercises: исключает пустые и незавершённые подходы и упражнения', () => {
  const exercises = [
    {
      name: 'Жим лёжа',
      sets: [
        { weight: 80, reps: 10, completed: true },
        { weight: 85, reps: 0, completed: true }, // 0 повторений
        { weight: 90, reps: 5, completed: false }, // не нажат чекбокс
      ],
    },
    {
      name: 'Присед',
      sets: [
        { weight: 100, reps: 5, completed: false }, // все не завершены
      ],
    },
  ];

  const filtered = filterCompletedExercises(exercises);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Жим лёжа');
  assert.equal(filtered[0].sets.length, 1);
  assert.deepEqual(filtered[0].sets[0], { weight: 80, reps: 10, completed: true });
});

test('getGhostValues: возвращает значения из прошлой тренировки или дефолтные', () => {
  const pastExercises = [
    {
      name: 'Жим лёжа',
      sets: [
        { weight: 80, reps: 10 },
        { weight: 85, reps: 8 },
      ],
    },
  ];

  const ghostSet0 = getGhostValues(pastExercises, 'Жим лёжа', 0);
  assert.deepEqual(ghostSet0, { weight: 80, reps: 10 });

  const ghostSet1 = getGhostValues(pastExercises, 'Жим лёжа', 1);
  assert.deepEqual(ghostSet1, { weight: 85, reps: 8 });

  // Если подходов в прошлый раз было меньше — берём последний подход
  const ghostSet2 = getGhostValues(pastExercises, 'Жим лёжа', 2);
  assert.deepEqual(ghostSet2, { weight: 85, reps: 8 });

  // Если упражнения не было — дефолтные 0
  const ghostUnknown = getGhostValues(pastExercises, 'Становая тяга', 0);
  assert.deepEqual(ghostUnknown, { weight: 0, reps: 10 });
});

test('calculateLive1RM: считает 1RM по Эпли с округлением до 0.5 кг', () => {
  // 100 кг на 10 повторений -> 100 * (1 + 10/30) = 133.33 -> 133.5
  assert.equal(calculateLive1RM(100, 10), 133.5);
  // 100 кг на 1 повторение -> 100
  assert.equal(calculateLive1RM(100, 1), 100);
  // 0 кг -> 0
  assert.equal(calculateLive1RM(0, 10), 0);
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает (Red)**

Run: `tsx --test "src/utils/liveWorkout.test.ts"`
Expected: FAIL (модуль ещё не реализован).

- [ ] **Step 3: Реализовать функции в `src/utils/liveWorkout.ts` и `webapp/src/utils/liveWorkout.ts`**

Создать `src/utils/liveWorkout.ts`:
```ts
export interface CompletedSet {
  weight: number;
  reps: number;
  completed?: boolean;
}

export interface LiveExerciseItem {
  name: string;
  sets: CompletedSet[];
}

export interface PastExerciseItem {
  name: string;
  sets: { weight: number; reps: number }[];
}

export function calculateSessionVolume(exercises: LiveExerciseItem[]): number {
  let volume = 0;
  for (const ex of exercises) {
    for (const set of ex.sets) {
      if (set.completed && set.weight > 0 && set.reps > 0) {
        volume += set.weight * set.reps;
      }
    }
  }
  return volume;
}

export function filterCompletedExercises(exercises: LiveExerciseItem[]): LiveExerciseItem[] {
  const result: LiveExerciseItem[] = [];
  for (const ex of exercises) {
    const validSets = ex.sets.filter((s) => s.completed && s.reps > 0);
    if (validSets.length > 0) {
      result.push({
        name: ex.name,
        sets: validSets,
      });
    }
  }
  return result;
}

export function getGhostValues(
  pastExercises: PastExerciseItem[] | null | undefined,
  exerciseName: string,
  setIndex: number
): { weight: number; reps: number } {
  if (!pastExercises) return { weight: 0, reps: 10 };

  const normTarget = exerciseName.trim().toLowerCase();
  const past = pastExercises.find((e) => e.name.trim().toLowerCase() === normTarget);
  if (!past || past.sets.length === 0) {
    return { weight: 0, reps: 10 };
  }

  if (setIndex < past.sets.length) {
    return { weight: past.sets[setIndex].weight, reps: past.sets[setIndex].reps };
  }

  const lastSet = past.sets[past.sets.length - 1];
  return { weight: lastSet.weight, reps: lastSet.reps };
}

export function calculateLive1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  const raw = weight * (1 + reps / 30);
  return Math.round(raw * 2) / 2;
}
```

Скопировать этот же чистый файл в `webapp/src/utils/liveWorkout.ts` (плюс хелперы для `localStorage`):
```ts
const DRAFT_KEY = 'gym95_active_workout_draft';

export interface ActiveWorkoutDraft {
  startTime: number;
  templateId?: string;
  exercises: {
    id: string;
    name: string;
    sets: { id: string; weight: number | ''; reps: number | ''; completed: boolean }[];
  }[];
}

export function saveWorkoutDraft(draft: ActiveWorkoutDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    console.warn('Не удалось сохранить черновик в localStorage', e);
  }
}

export function loadWorkoutDraft(): ActiveWorkoutDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearWorkoutDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Запустить тесты и проверить прохождение (Green)**

Run: `npm test`
Expected: PASS (все 95 тестов проходят).

---

### Task 3: Бэкенд API (`/api/live-context` и `POST /api/workouts`)

**Files:**
- Create: `src/webapp/live.ts`
- Modify: `src/webapp/server.ts`
- Test: `src/webapp/live.test.ts`

- [ ] **Step 1: Написать тест на валидацию и логику сохранения тренировки из Live Workout**

Создать `src/webapp/live.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLiveWorkoutPayload } from './live';

test('validateLiveWorkoutPayload: отклоняет пустой список упражнений', () => {
  const result = validateLiveWorkoutPayload({
    durationMinutes: 45,
    exercises: [],
  });
  assert.equal(result.ok, false);
});

test('validateLiveWorkoutPayload: валидирует корректную силовую сессию', () => {
  const result = validateLiveWorkoutPayload({
    durationMinutes: 45,
    warmupMinutes: 5,
    exercises: [
      {
        name: 'Жим лёжа',
        sets: [
          { weight: 80, reps: 10, completed: true },
          { weight: 85, reps: 8, completed: true },
        ],
      },
    ],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.exercises.length, 1);
    assert.equal(result.data.exercises[0].sets.length, 2);
  }
});
```

- [ ] **Step 2: Реализовать логику в `src/webapp/live.ts`**

Создать `src/webapp/live.ts`:
- Реализовать `validateLiveWorkoutPayload`.
- Реализовать `getLiveContext(userId)`: получает шаблоны пользователя из `listTemplates(userId)`, последнюю силовую тренировку из `getRecentWorkouts(userId, 5, 0)` + `getExercisesByWorkoutId`, и частые упражнения из `getExerciseNames(userId, 50)`.
- Реализовать `saveLiveWorkout(userId, payload)`:
  - Проверяет валидность.
  - Сохраняет тренировку через `createWorkout({ userId, type: 'strength', durationMinutes, warmupMinutes })`.
  - Сохраняет подходы через `addExercise`.
  - Если передан `saveAsTemplateName` — вызывает `createTemplate`.
  - Рассчитывает новые 1RM рекорды.
  - Формирует читаемый `summaryText`.

- [ ] **Step 3: Подключить роуты в `src/webapp/server.ts`**

В `src/webapp/server.ts`:
- В обработчике `handleApi`:
  - `case '/api/live-context':` возвращает `await getLiveContext(user.userId)`.
  - При `method === 'POST' && url.pathname === '/api/workouts':` читает `readJsonBody(req)`, вызывает `saveLiveWorkout(user.userId, body)` и отдаёт `200` с результатом.

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: Все тесты проходят успешно.

---

### Task 4: API клиент и интеграция во фронтенд

**Files:**
- Modify: `webapp/src/api.ts`

- [ ] **Step 1: Добавить методы в `webapp/src/api.ts`**

В `webapp/src/api.ts` добавить методы:
```ts
liveContext(): Promise<LiveContextResponse> {
  return request<LiveContextResponse>('/api/live-context');
},
saveLiveWorkout(data: SaveLiveWorkoutRequest): Promise<SaveLiveWorkoutResponse> {
  return request<SaveLiveWorkoutResponse>('/api/workouts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},
```

- [ ] **Step 2: Запустить `npm --prefix webapp run build`**

Run: `npm --prefix webapp run build`
Expected: Успешная сборка.

---

### Task 5: UI экран Live Workout (Workout Hub + Active Session + Finish)

**Files:**
- Create: `webapp/src/screens/LiveWorkoutScreen.tsx`
- Modify: `webapp/src/styles.css`
- Modify: `webapp/src/App.tsx`

- [ ] **Step 1: Создать компонент `webapp/src/screens/LiveWorkoutScreen.tsx`**

Реализовать компонент с тремя состояниями:
1. **Hub (когда тренировка не начата):**
   - Кнопка «⚡ Повторить последнюю» (карточка с превью даты и упражнений).
   - Список «📋 Шаблоны тренировок».
   - Кнопка «➕ Свободная тренировка».
2. **Active Session (когда тренировка идёт):**
   - Sticky Header с секундомером, тоннажем, кнопкой «Финиш» и кнопкой отмены «✕».
   - Список упражнений с таблицей сетов: Сет №, Прошлый (ghost), Вес (input), Повт (input), `[ ✓ ]`.
   - Кнопка «+ Добавить подход» и удаление подхода.
   - Шторка «+ Добавить упражнение» с поиском по базе и фильтрами мышц.
   - Плавающий таймер отдыха внизу экрана с `+30с`, пропуском, звуковым сигналом и Telegram Haptic.
3. **Finish Summary Modal:**
   - Показ сводки: длительность, тоннаж, выполненные подходы.
   - Бейджи новых рекордов 1RM.
   - Поле «Сохранить как шаблон».
   - Кнопка закрытия и перехода в историю.

- [ ] **Step 2: Добавить стили в `webapp/src/styles.css`**

Добавить стили для:
- `.workout-hub` (карточки быстрого старта, шаблонов).
- `.live-workout-header` (секундомер, тоннаж, кнопка финиша).
- `.exercise-live-card` (таблица сетов, инпуты ghost values, зеленый чекбокс при выполнении).
- `.floating-rest-timer` (плавающая плашка с обратным отсчётом и кнопками).
- `.finish-summary-modal` (модальное окно завершения с конфетти).

- [ ] **Step 3: Добавить вкладку «⚡ В зал» в `webapp/src/App.tsx`**

В `webapp/src/App.tsx`:
- Добавить `'workout'` в `type Tab = 'workout' | 'history' | 'progress' | 'body' | 'timer'`.
- Ленивый импорт `LiveWorkoutScreen`.
- Добавить кнопку в таббар:
  ```tsx
  <button className={`tab${tab === 'workout' ? ' active' : ''}`} onClick={() => switchTab('workout')}>
    <span className="tab-icon">⚡</span>
    В зал
  </button>
  ```
- Отображать `LiveWorkoutScreen` при активной вкладке `'workout'`.

- [ ] **Step 4: Проверить сборку фронтенда**

Run: `npm --prefix webapp run build`
Expected: `vite build` успешно собирает все бандлы без ошибок.

---

### Task 6: Регрессионное тестирование и верификация

**Files:**
- All modified files

- [ ] **Step 1: Полный запуск unit-тестов бэкенда**

Run: `npm test`
Expected: Все тесты проходят (95+ passed, 0 failed).

- [ ] **Step 2: Полная проверка компиляции проекта**

Run: `tsc -p tsconfig.json`
Expected: Код компилируется без ошибок типов.

- [ ] **Step 3: Проверка сборки Mini App**

Run: `npm --prefix webapp run build`
Expected: Багдлинг проходит за <10с, бандлы оптимизированы.
