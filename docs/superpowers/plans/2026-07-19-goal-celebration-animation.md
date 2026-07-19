# Celebration-анимация цели недели Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одноразовая (не зацикленная) анимация + haptic-отклик на плитке «цель недели» в Mini App, когда пользователь впервые за календарную неделю видит её в состоянии «цель достигнута».

**Architecture:** Вся логика — внутри `SummaryBar.tsx` (единственный владелец рендера плитки): дедупликация через `localStorage` по ключу `gym95:goal-celebrated:<понедельник-этой-недели>`, локальный React-стейт `celebrating` включает CSS-класс `.celebrate` на плитке, класс снимает себя сам по `onAnimationEnd`. Никаких изменений в бэкенде, схеме БД или контрактах API.

**Tech Stack:** React + TypeScript (Vite), CSS keyframe-анимации, Telegram WebApp haptics (`notifyHaptic`, уже существует в `webapp/src/telegram.ts`). Проект не использует автоматических тестов (нет jest/vitest во всей истории репозитория) — верификация через `tsc`/сборку и ручной dogfood-прогон, как и во всех предыдущих фичах.

**Спек:** [docs/superpowers/specs/2026-07-19-goal-celebration-animation-design.md](../specs/2026-07-19-goal-celebration-animation-design.md)

---

### Task 1: Триггер и дедупликация в `SummaryBar.tsx`

**Files:**
- Modify: `webapp/src/components/SummaryBar.tsx`

- [ ] **Step 1: Заменить весь файл**

Текущее содержимое файла:

```tsx
import type { SummaryResponse } from '../../shared/types';
import { pluralizeRu } from '../format';

export function SummaryBar({ summary }: { summary: SummaryResponse }) {
  const streakLabel = pluralizeRu(summary.weekStreak, ['неделя', 'недели', 'недель']);

  // Прогресс к недельной цели по частоте. weekGoal <= 0 (если цель когда-то так
  // настроят) не должен ломать плитку: считаем бар пустым, без состояния «готово».
  const goal = summary.weekGoal;
  const reached = goal > 0 && summary.weekWorkouts >= goal;
  const fillRatio = goal > 0 ? Math.min(summary.weekWorkouts / goal, 1) : 0;

  return (
    <div className="stat-row">
      <div className="stat-tile hero">
        <div className="stat-value">🔥 {summary.weekStreak}</div>
        <div className="stat-label">{streakLabel} подряд</div>
      </div>
      <div className="stat-tile">
        <div className="stat-value">{summary.totalWorkouts}</div>
        <div className="stat-label">всего тренировок</div>
      </div>
      <div className={`stat-tile${reached ? ' reached' : ''}`}>
        <div className="stat-value">
          {summary.weekWorkouts} / {goal}
          {reached && ' ✓'}
        </div>
        <div className="stat-label">цель недели</div>
        <div className="stat-progress" aria-hidden="true">
          <div className="stat-progress-fill" style={{ transform: `scaleX(${fillRatio})` }} />
        </div>
      </div>
    </div>
  );
}
```

Заменить целиком на:

```tsx
import { useEffect, useState } from 'react';
import type { SummaryResponse } from '../../shared/types';
import { pluralizeRu } from '../format';
import { notifyHaptic } from '../telegram';

// Понедельник текущей календарной недели по локальной дате клиента, YYYY-MM-DD.
// Используется только как ключ дедупликации в localStorage — не обязан
// побитово совпадать с UTC-версией mondayKey на бэкенде.
function weekMondayKey(): string {
  const d = new Date();
  const day = d.getDay(); // 0=вс..6=сб
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function SummaryBar({ summary }: { summary: SummaryResponse }) {
  const streakLabel = pluralizeRu(summary.weekStreak, ['неделя', 'недели', 'недель']);

  // Прогресс к недельной цели по частоте. weekGoal <= 0 (если цель когда-то так
  // настроят) не должен ломать плитку: считаем бар пустым, без состояния «готово».
  const goal = summary.weekGoal;
  const reached = goal > 0 && summary.weekWorkouts >= goal;
  const fillRatio = goal > 0 ? Math.min(summary.weekWorkouts / goal, 1) : 0;

  const [celebrating, setCelebrating] = useState(false);

  // Тренировки создаются только через бота (не в Mini App), поэтому момент
  // «цель только что закрыта» в реальном сценарии почти всегда совпадает с
  // холодной загрузкой Mini App, а не с живым переходом reached=false→true
  // внутри одной сессии компонента. Дедупликация через localStorage по неделе
  // играет роль «было ли это уже показано» вместо сравнения с предыдущим рендером.
  useEffect(() => {
    if (!reached) return;
    const key = `gym95:goal-celebrated:${weekMondayKey()}`;
    try {
      if (localStorage.getItem(key) === '1') return;
      localStorage.setItem(key, '1');
    } catch {
      // localStorage недоступен (приватный режим и т.п.) — деградация:
      // анимация может сыграть больше одного раза за неделю, но не рушим рендер.
    }
    setCelebrating(true);
    notifyHaptic('success');
  }, [reached, summary.weekWorkouts, summary.weekGoal]);

  return (
    <div className="stat-row">
      <div className="stat-tile hero">
        <div className="stat-value">🔥 {summary.weekStreak}</div>
        <div className="stat-label">{streakLabel} подряд</div>
      </div>
      <div className="stat-tile">
        <div className="stat-value">{summary.totalWorkouts}</div>
        <div className="stat-label">всего тренировок</div>
      </div>
      <div
        className={`stat-tile${reached ? ' reached' : ''}${celebrating ? ' celebrate' : ''}`}
        onAnimationEnd={() => setCelebrating(false)}
      >
        <div className="stat-value">
          {summary.weekWorkouts} / {goal}
          {reached && ' ✓'}
        </div>
        <div className="stat-label">цель недели</div>
        <div className="stat-progress" aria-hidden="true">
          <div className="stat-progress-fill" style={{ transform: `scaleX(${fillRatio})` }} />
        </div>
      </div>
    </div>
  );
}
```

**Примечание для реализующего:** CSS-анимация `.celebrate` (Task 2) будет
применена и к самой плитке, и к её `::before` (диагональный блик) —
оба — `@keyframes`-анимации одной длительности на одном DOM-узле (`::before`
не отдельный узел, события анимации всё равно репортятся с `target`, равным
самому этому `<div>`). Поэтому `onAnimationEnd` может вызваться дважды за один
цикл — это ожидаемо и безвредно: `setCelebrating(false)` идемпотентен, React не
перерендерит компонент повторно от одинакового значения состояния.
Дополнительных проверок (`e.target === e.currentTarget` и т.п.) не требуется.

- [ ] **Step 2: Проверить компиляцию webapp**

Run: `npx tsc --noEmit -p webapp/tsconfig.json`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/SummaryBar.tsx
git commit -m "feat(webapp): триггер celebration-анимации цели недели"
```

---

### Task 2: CSS-анимация «блик-развёртка»

**Files:**
- Modify: `webapp/src/styles.css`

- [ ] **Step 1: Добавить стили после блока `.stat-tile.hero .stat-value, .stat-tile.reached .stat-value`**

В `webapp/src/styles.css` найти блок (сразу после `.stat-tile.hero, .stat-tile.reached { ... }`):

```css
.stat-tile.hero .stat-value,
.stat-tile.reached .stat-value {
  color: var(--lime-ink);
}
```

Сразу после него (перед `.stat-value { ... }`) добавить:

```css
/* Одноразовая анимация при первом достижении цели недели за эту неделю
   (дедупликация — в SummaryBar.tsx через localStorage). Блик идёт через
   ::before, а не ::after, потому что ::after у .stat-tile уже занят под
   акцентную полоску снизу плитки (см. .stat-tile::after выше) — использование
   ::after здесь перекрыло бы её на время анимации. */
.stat-tile.celebrate {
  animation: celebrateGlow 1.4s ease-out;
}
.stat-tile.celebrate::before {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 40%;
  height: 100%;
  background: linear-gradient(115deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  animation: celebrateSweep 1.4s ease-out;
  pointer-events: none;
}
@keyframes celebrateGlow {
  0%,
  100% {
    box-shadow: var(--glow);
  }
  35% {
    box-shadow: 0 0 22px rgba(201, 255, 46, 0.65);
  }
}
@keyframes celebrateSweep {
  0% {
    left: -60%;
  }
  100% {
    left: 130%;
  }
}
```

**Почему `0%, 100% { box-shadow: var(--glow); }` в `celebrateGlow`, а не
`box-shadow: none` на 0%:** плитка уже находится в состоянии `.reached` (обе
CSS-класса, `reached` и `celebrate`, всегда применяются одновременно — см.
`SummaryBar.tsx`), у которого уже есть статичный `box-shadow: var(--glow)`.
Если анимация начиналась бы с `none`, свечение на долю секунды пропадало бы
перед тем как разгореться — заметный, нежелательный «мигающий выключатель»
эффект. Начиная и заканчивая на `var(--glow)`, анимация читается как чистый
пульс поверх уже существующего свечения, без скачка в начале и в конце (после
завершения анимации и снятия класса `.celebrate` статичное правило `.reached`
продолжает применять тот же `var(--glow)` — стыковка бесшовная).

- [ ] **Step 2: Собрать webapp и убедиться, что сборка зелёная**

Run: `npm --prefix webapp run build`
Expected: exit code 0, `webapp/dist` пересобран без ошибок TS/Vite.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/styles.css
git commit -m "feat(webapp): стили celebration-анимации цели недели"
```

---

### Task 3: Полная сборка и ручной прогон

**Files:** нет изменений — только верификация.

- [ ] **Step 1: Полная сборка проекта**

Run: `npm run build`
Expected: exit code 0 (бэкенд `tsc` не затронут этой фичей, но команда пересобирает и `webapp`; убедиться, что она по-прежнему зелёная).

- [ ] **Step 2: Ручной прогон (dogfood)**

Открыть Mini App в браузере (вне Telegram — `npm --prefix webapp run dev` — или через настоящий Telegram после деплоя) и в DevTools:

1. Открыть вкладку Application → Local Storage, удалить все ключи вида
   `gym95:goal-celebrated:*` (или открыть страницу в приватном/инкогнито-окне).
2. Добиться в данных состояния `weekWorkouts >= weekGoal` (например, через
   `/settings` в боте временно понизить цель до значения, уже достигнутого на
   этой неделе) → открыть/обновить Mini App → плитка «цель недели» должна один
   раз проиграть анимацию (пульс свечения + диагональный блик) при появлении.
3. Обновить страницу ещё раз (или закрыть/открыть Mini App заново) в течение
   той же недели → анимация **не** повторяется, плитка отображается в обычном
   статичном состоянии «достигнуто» (акцентная граница, `✓`, залитый бар —
   без анимации).
4. Проверить `localStorage` в DevTools — ключ `gym95:goal-celebrated:<дата>`
   действительно появился после первого проигрывания.
5. Переключить тему Telegram (светлая/тёмная) — граница плитки и haptic
   работают в обеих; яркое свечение уместно заметно только в тёмной (это не
   баг, а уже существующий в проекте принцип — `--glow` определён как `none`
   в светлой теме).

- [ ] **Step 3: Задеплоить**

```bash
git push
```

Render автоматически задеплоит по пушу в `master`. После деплоя, если
тестировали только локально, повторить пункты 2–5 из Step 2 уже на проде в
настоящем Telegram-клиенте.

---

## Self-Review

- **Покрытие спека:** «Триггер и дедупликация» (спек, п. 1) → Task 1;
  «Анимация» (спек, п. 2) → Task 2; «Обработка ошибок и краевые случаи» (спек,
  п. 3) — `try/catch` вокруг `localStorage` в Task 1, `weekGoal <= 0` защита не
  трогается (уже в коде до этой фичи), поведение при повторном достижении в
  течение недели явно описано и покрыто дедупликацией по ключу-неделе.
  «Тестирование» из спека → Task 3.
- **Плейсхолдеров нет** — каждый шаг содержит точный код или точную команду с
  ожидаемым результатом.
- **Согласованность:** класс `celebrate`, ключ `gym95:goal-celebrated:<...>`,
  функция `weekMondayKey()` и обработчик `onAnimationEnd` используются
  одинаково между Task 1 (JSX/логика) и Task 2 (CSS-селекторы) — имена
  совпадают буквально. Обнаруженный при подготовке плана конфликт
  `.stat-tile::after` (уже занят под акцентную полоску) с изначально
  предполагавшимся `::after` для блика — исправлено на `::before` в Task 2 до
  того, как это стало багом.
