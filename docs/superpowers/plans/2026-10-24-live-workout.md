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

- [x] **Step 2: Запустить тест и убедиться, что он падает (Red)**
...
- [x] **Step 3: Реализовать функции в `src/utils/liveWorkout.ts` и `webapp/src/utils/liveWorkout.ts`**
...
- [x] **Step 4: Запустить тесты и проверить прохождение (Green)**

---

### Task 3: Бэкенд API (`/api/live-context` и `POST /api/workouts`)

- [x] **Step 1: Написать тест на валидацию и логику сохранения тренировки из Live Workout**
- [x] **Step 2: Реализовать логику в `src/webapp/live.ts`**
- [x] **Step 3: Подключить роуты в `src/webapp/server.ts`**
- [x] **Step 4: Прогнать тесты**

---

### Task 4: API клиент и интеграция во фронтенд

- [x] **Step 1: Добавить методы в `webapp/src/api.ts`**
- [x] **Step 2: Запустить `npm --prefix webapp run build`**

---

### Task 5: UI экран Live Workout (Workout Hub + Active Session + Finish)

- [x] **Step 1: Создать компонент `webapp/src/screens/LiveWorkoutScreen.tsx`**
- [x] **Step 2: Добавить стили в `webapp/src/styles.css`**
- [x] **Step 3: Добавить вкладку «⚡ В зал» в `webapp/src/App.tsx`**
- [x] **Step 4: Проверить сборку фронтенда**

---

### Task 6: Регрессионное тестирование и верификация

- [x] **Step 1: Полный запуск unit-тестов бэкенда**
- [x] **Step 2: Полная проверка компиляции проекта**
- [x] **Step 3: Проверка сборки Mini App**

