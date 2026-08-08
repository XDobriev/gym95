# Повтор тренировки Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить кнопку «🔁 Повторить» (после `/done` и в `/history`) для силовых тренировок, которая создаёт новый черновик, предзаполненный упражнениями и подходами исходной тренировки, с экраном-превью для точечной правки перед сохранением.

**Architecture:** Новый шаг `reviewing_repeat` в существующей `DraftWorkout` FSM (`src/handlers/workout/state.ts`), без новой параллельной FSM. Новый файл `src/handlers/workout/repeatStep.ts` собирает черновик из сохранённой тренировки (`getWorkoutOwned` + `getExercisesByWorkoutId`) и рендерит экран-превью со списком упражнений; каждое упражнение можно заменить (через уже существующий шаг `entering_sets`, помеченный новым полем `editingExerciseIndex`) или удалить. «Добавить упражнение» и «Завершить» переиспользуют существующие `handleNextExercise`/`handleFinishAction` без изменений — они не завязаны на конкретный шаг черновика.

**Tech Stack:** TypeScript, Telegraf, Supabase Postgres. Проект не использует автоматических тестов (jest/vitest отсутствуют во всей истории репозитория) — верификация каждого шага через `tsc --noEmit` и, в конце, ручной smoke-прогон в реальном боте, как и во всех предыдущих фичах этого проекта.

**Спек:** [docs/superpowers/specs/2026-08-08-workout-repeat-design.md](../specs/2026-08-08-workout-repeat-design.md)

---

### Task 1: Новый шаг и поля черновика

**Files:**
- Modify: `src/types/draft.ts`

- [ ] **Step 1: Добавить шаг `reviewing_repeat`**

Заменить:

```ts
export type WorkoutStep =
  | 'choosing_type'
  | 'entering_warmup'
  | 'choosing_exercise_name'
  | 'choosing_muscle_group'
  | 'choosing_exercise_in_group'
  | 'entering_custom_exercise_name'
  | 'entering_sets'
  | 'exercise_saved_menu'
  | 'choosing_cardio_activity'
  | 'entering_cardio_duration'
  | 'entering_cardio_distance'
  | 'entering_cardio_incline'
  | 'entering_cardio_pulse'
  | 'cardio_saved_menu';
```

на:

```ts
export type WorkoutStep =
  | 'choosing_type'
  | 'entering_warmup'
  | 'choosing_exercise_name'
  | 'choosing_muscle_group'
  | 'choosing_exercise_in_group'
  | 'entering_custom_exercise_name'
  | 'entering_sets'
  | 'exercise_saved_menu'
  | 'choosing_cardio_activity'
  | 'entering_cardio_duration'
  | 'entering_cardio_distance'
  | 'entering_cardio_incline'
  | 'entering_cardio_pulse'
  | 'cardio_saved_menu'
  | 'reviewing_repeat';
```

- [ ] **Step 2: Добавить поля в `DraftWorkout`**

Заменить:

```ts
export interface DraftWorkout {
  userId: number;
  type: WorkoutType | null;
  step: WorkoutStep;
  exercises: DraftExercise[];
  currentExerciseName?: string;
  appendToLastExercise?: boolean;
  recentExerciseNames?: string[];
  groupExerciseNames?: string[];
  warmupMinutes?: number;
  cardio?: DraftCardio;
  startedAt: number;
  chatId: number;
  lastMessageId?: number;
}
```

на:

```ts
export interface DraftWorkout {
  userId: number;
  type: WorkoutType | null;
  step: WorkoutStep;
  exercises: DraftExercise[];
  currentExerciseName?: string;
  appendToLastExercise?: boolean;
  recentExerciseNames?: string[];
  groupExerciseNames?: string[];
  warmupMinutes?: number;
  cardio?: DraftCardio;
  startedAt: number;
  chatId: number;
  lastMessageId?: number;
  editingExerciseIndex?: number;
  repeatSourceDate?: string;
}
```

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок (новые поля пока нигде не используются, но должны компилироваться сами по себе).

- [ ] **Step 4: Commit**

```bash
git add src/types/draft.ts
git commit -m "feat(bot): шаг reviewing_repeat и поля черновика для повтора тренировки"
```

---

### Task 2: Клавиатуры экрана повтора

**Files:**
- Modify: `src/handlers/workout/keyboards.ts`

- [ ] **Step 1: Добавить три функции в конец файла**

В конце `src/handlers/workout/keyboards.ts`, после функции `resumeOrRestartKeyboard` (последняя функция в файле), добавить:

```ts

// Кнопка «Повторить это» под итоговым сообщением после /done — только для силовых.
export function repeatDoneKeyboard(workoutId: string): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔁 Повторить это', `w:repeat:${workoutId}`)],
  ]).reply_markup;
}

// Экран-превью повтора тренировки: пара кнопок «правка/удаление» на каждое
// упражнение (по образцу editMenuKeyboard), плюс добавление, завершение, отмена.
export function repeatReviewKeyboard(exerciseNames: string[]): InlineKeyboardMarkup {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  exerciseNames.forEach((name, index) => {
    rows.push([
      Markup.button.callback(`✏️ ${truncateForButton(name)}`, `w:repeat_edit_ex:${index}`),
      Markup.button.callback('🗑', `w:repeat_del_ex:${index}`),
    ]);
  });

  rows.push([Markup.button.callback('➕ Добавить упражнение', 'w:next_exercise')]);
  rows.push([Markup.button.callback('✅ Завершить тренировку', 'w:finish')]);
  rows.push([Markup.button.callback('❌ Отменить', 'w:cancel_workout')]);

  return Markup.inlineKeyboard(rows).reply_markup;
}

// Кнопка отмены под промптом замены подходов на экране повтора — возвращает
// на экран повтора (не в общий выбор упражнения), в отличие от enteringSetsKeyboard.
export function repeatEditSetsKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'w:repeat_edit_cancel')]]).reply_markup;
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/handlers/workout/keyboards.ts
git commit -m "feat(bot): клавиатуры экрана повтора тренировки"
```

---

### Task 3: `finish.ts` возвращает `workoutId`/`type`

**Files:**
- Modify: `src/handlers/workout/finish.ts`

- [ ] **Step 1: Импортировать `WorkoutType`, расширить `FinishResult`**

Заменить:

```ts
import { getDraft, clearDraft } from './state';
import { createWorkout } from '../../db/workouts';
import { addExercise } from '../../db/exercises';
import { addCardioSession } from '../../db/cardio';
import { computeAvgPace } from '../../utils/cardio';
import { formatCardioInline, formatSetsInline } from '../../utils/format';

export type FinishResult =
  | { ok: true; text: string }
  | { ok: false; text: string };
```

на:

```ts
import { getDraft, clearDraft } from './state';
import { createWorkout } from '../../db/workouts';
import { addExercise } from '../../db/exercises';
import { addCardioSession } from '../../db/cardio';
import { computeAvgPace } from '../../utils/cardio';
import { formatCardioInline, formatSetsInline } from '../../utils/format';
import { WorkoutType } from '../../types/domain';

export type FinishResult =
  | { ok: true; text: string; workoutId: string; type: WorkoutType }
  | { ok: false; text: string };
```

- [ ] **Step 2: Зафиксировать сузенный тип `type` сразу после гварда**

Заменить:

```ts
  if (!draft || !draft.type || (!hasExercises && !hasCardio)) {
    clearDraft(userId);
    return { ok: false, text: 'Тренировка без данных не сохранена.' };
  }

  const workout = await createWorkout({
    userId,
    type: draft.type,
    durationMinutes: draft.cardio?.durationMinutes,
    warmupMinutes: draft.warmupMinutes,
  });
```

на:

```ts
  if (!draft || !draft.type || (!hasExercises && !hasCardio)) {
    clearDraft(userId);
    return { ok: false, text: 'Тренировка без данных не сохранена.' };
  }

  const type = draft.type;

  const workout = await createWorkout({
    userId,
    type,
    durationMinutes: draft.cardio?.durationMinutes,
    warmupMinutes: draft.warmupMinutes,
  });
```

(`type` вынесен в отдельную константу до первого `await` — иначе после нескольких `await` ниже по функции TypeScript не гарантирует, что `draft.type` всё ещё сужен от `WorkoutType | null` до `WorkoutType`.)

- [ ] **Step 3: Вернуть `workoutId`/`type` в успешном результате**

Заменить:

```ts
  clearDraft(userId);

  return {
    ok: true,
    text: `✅ Тренировка сохранена!\n\n${sections.join('\n\n')}\n\nПосмотреть историю — /history`,
  };
}
```

на:

```ts
  clearDraft(userId);

  return {
    ok: true,
    text: `✅ Тренировка сохранена!\n\n${sections.join('\n\n')}\n\nПосмотреть историю — /history`,
    workoutId: workout.id,
    type,
  };
}
```

- [ ] **Step 4: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/handlers/workout/finish.ts
git commit -m "feat(bot): saveDraftWorkout возвращает workoutId и type"
```

---

### Task 4: Новый файл `repeatStep.ts`

**Files:**
- Create: `src/handlers/workout/repeatStep.ts`

- [ ] **Step 1: Создать файл целиком**

```ts
import { Telegraf, Context } from 'telegraf';
import { DraftWorkout } from '../../types/draft';
import { Workout, Exercise } from '../../types/domain';
import { getDraft, startDraft, setStep } from './state';
import { getWorkoutOwned } from '../../db/workouts';
import { getExercisesByWorkoutId } from '../../db/exercises';
import { formatSetsInline, formatDateShortRu } from '../../utils/format';
import { repeatReviewKeyboard, repeatEditSetsKeyboard, resumeOrRestartKeyboard } from './keyboards';
import { otherActiveFlow, activeFlowBlockedMessage } from '../activeFlow';

function buildDraftFromWorkout(
  userId: number,
  chatId: number,
  workout: Workout,
  exercises: Exercise[]
): DraftWorkout {
  const draft = startDraft(userId, chatId);
  draft.type = 'strength';
  draft.step = 'reviewing_repeat';
  draft.warmupMinutes = workout.warmup_minutes ?? undefined;
  draft.repeatSourceDate = workout.date;
  draft.exercises = exercises.map((ex, index) => ({
    name: ex.name,
    sets: ex.sets.map((s) => ({ ...s })),
    orderIndex: index,
  }));
  return draft;
}

function repeatReviewText(draft: DraftWorkout): string {
  const header = draft.repeatSourceDate
    ? `🔁 Повтор тренировки от ${formatDateShortRu(draft.repeatSourceDate)}`
    : '🔁 Повтор тренировки';

  if (draft.exercises.length === 0) {
    return `${header}\n\nВсе упражнения удалены — добавь хотя бы одно, прежде чем завершать.`;
  }

  const lines = draft.exercises.map((ex, i) => `${i + 1}. ${ex.name}: ${formatSetsInline(ex.sets)}`);

  return [
    header,
    '',
    ...lines,
    '',
    'Прими как есть или поправь упражнение кнопкой, затем «✅ Завершить тренировку».',
  ].join('\n');
}

// viaEdit=true — вызов из callback (редактируем текущее сообщение), false — из
// текстового апдейта (шлём новое сообщение, как и весь остальной FSM создания).
export async function renderRepeatReview(ctx: Context, draft: DraftWorkout, viaEdit: boolean): Promise<void> {
  const text = repeatReviewText(draft);
  const reply_markup = repeatReviewKeyboard(draft.exercises.map((ex) => ex.name));
  if (viaEdit) {
    await ctx.editMessageText(text, { reply_markup });
  } else {
    await ctx.reply(text, { reply_markup });
  }
}

export function registerWorkoutRepeat(bot: Telegraf): void {
  bot.action(/^w:repeat:([^:]+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (!userId || !chatId) return;

    const existing = getDraft(userId);
    if (existing) {
      await ctx.reply(
        'У тебя уже есть незавершённая тренировка. Продолжить её или начать заново?',
        { reply_markup: resumeOrRestartKeyboard() }
      );
      return;
    }

    const conflict = otherActiveFlow(userId, 'draft');
    if (conflict) {
      await ctx.reply(activeFlowBlockedMessage(conflict));
      return;
    }

    const workoutId = ctx.match[1];
    const workout = await getWorkoutOwned(userId, workoutId);
    if (!workout) {
      await ctx.reply('Тренировка не найдена — возможно, уже удалена.');
      return;
    }
    if (workout.type !== 'strength') {
      await ctx.reply('Повтор пока доступен только для силовых тренировок.');
      return;
    }

    const exercises = await getExercisesByWorkoutId(workoutId);
    if (exercises.length === 0) {
      await ctx.reply('В той тренировке не было упражнений — нечего повторять.');
      return;
    }

    const draft = buildDraftFromWorkout(userId, chatId, workout, exercises);
    await renderRepeatReview(ctx, draft, true);
  });

  bot.action(/^w:repeat_edit_ex:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const draft = getDraft(userId);
    if (!draft || draft.step !== 'reviewing_repeat') return;

    const index = parseInt(ctx.match[1], 10);
    const exercise = draft.exercises[index];
    if (!exercise) return;

    draft.editingExerciseIndex = index;
    draft.currentExerciseName = exercise.name;
    setStep(userId, 'entering_sets');

    await ctx.editMessageText(
      `${exercise.name}. Сейчас: ${formatSetsInline(exercise.sets)}\nВведи новые подходы взамен, например: 40x12, 40x12`,
      { reply_markup: repeatEditSetsKeyboard() }
    );
  });

  bot.action('w:repeat_edit_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const draft = getDraft(userId);
    if (!draft) return;

    draft.editingExerciseIndex = undefined;
    draft.currentExerciseName = undefined;
    setStep(userId, 'reviewing_repeat');

    await renderRepeatReview(ctx, draft, true);
  });

  bot.action(/^w:repeat_del_ex:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const draft = getDraft(userId);
    if (!draft || draft.step !== 'reviewing_repeat') return;

    const index = parseInt(ctx.match[1], 10);
    if (!draft.exercises[index]) return;

    draft.exercises.splice(index, 1);
    draft.exercises.forEach((ex, i) => {
      ex.orderIndex = i;
    });

    await renderRepeatReview(ctx, draft, true);
  });
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок. (Файл пока нигде не импортируется — это нормально, TS всё равно проверяет каждый файл проекта.)

- [ ] **Step 3: Commit**

```bash
git add src/handlers/workout/repeatStep.ts
git commit -m "feat(bot): экран повтора тренировки — сборка черновика и правка упражнений"
```

---

### Task 5: `setsInputStep.ts` — замена подходов при повторе

**Files:**
- Modify: `src/handlers/workout/setsInputStep.ts`

- [ ] **Step 1: Импортировать `repeatEditSetsKeyboard` и `renderRepeatReview`**

Заменить:

```ts
import { Context } from 'telegraf';
import { DraftWorkout } from '../../types/draft';
import { getDraft, setStep, canAddCardio } from './state';
import { parseSetsLine } from '../../utils/setsParser';
import { formatSetsInline, pluralizeRu } from '../../utils/format';
import { enteringSetsKeyboard, exerciseSavedMenuKeyboard, exerciseNameKeyboard } from './keyboards';
import { getLastExercisesByUser } from '../../db/exercises';
```

на:

```ts
import { Context } from 'telegraf';
import { DraftWorkout } from '../../types/draft';
import { getDraft, setStep, canAddCardio } from './state';
import { parseSetsLine } from '../../utils/setsParser';
import { formatSetsInline, pluralizeRu } from '../../utils/format';
import {
  enteringSetsKeyboard,
  exerciseSavedMenuKeyboard,
  exerciseNameKeyboard,
  repeatEditSetsKeyboard,
} from './keyboards';
import { getLastExercisesByUser } from '../../db/exercises';
import { renderRepeatReview } from './repeatStep';
```

- [ ] **Step 2: Ветвление в `handleSetsTextEntered`**

Заменить:

```ts
export async function handleSetsTextEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.currentExerciseName) return;

  const result = parseSetsLine(text);

  if (!result.ok) {
    await ctx.reply(result.error, { reply_markup: enteringSetsKeyboard() });
    return;
  }

  upsertCurrentExercise(draft, draft.currentExerciseName, result.sets);
  setStep(userId, 'exercise_saved_menu');

  await ctx.reply(renderExerciseSavedMenu(draft), {
    reply_markup: exerciseSavedMenuKeyboard(canAddCardio(draft)),
  });
}
```

на:

```ts
export async function handleSetsTextEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft || !draft.currentExerciseName) return;

  const result = parseSetsLine(text);
  const editingIndex = draft.editingExerciseIndex;

  if (!result.ok) {
    await ctx.reply(result.error, {
      reply_markup: editingIndex !== undefined ? repeatEditSetsKeyboard() : enteringSetsKeyboard(),
    });
    return;
  }

  if (editingIndex !== undefined) {
    const exercise = draft.exercises[editingIndex];
    if (exercise) exercise.sets = result.sets;
    draft.editingExerciseIndex = undefined;
    draft.currentExerciseName = undefined;
    setStep(userId, 'reviewing_repeat');
    await renderRepeatReview(ctx, draft, false);
    return;
  }

  upsertCurrentExercise(draft, draft.currentExerciseName, result.sets);
  setStep(userId, 'exercise_saved_menu');

  await ctx.reply(renderExerciseSavedMenu(draft), {
    reply_markup: exerciseSavedMenuKeyboard(canAddCardio(draft)),
  });
}
```

Это критичное поведение: если `editingExerciseIndex` задан (пользователь пришёл через «✏️» на экране повтора), новый ввод **заменяет** подходы этого конкретного упражнения и возвращает на экран повтора — вместо обычного пути «добавить как новое/дописать к последнему». Ошибка парсинга в этом режиме тоже должна вести назад на экран повтора (через `repeatEditSetsKeyboard`), а не в общий выбор упражнения — иначе `editingExerciseIndex` останется зависшим и следующий обычный ввод подходов затрёт не то упражнение.

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/handlers/workout/setsInputStep.ts
git commit -m "feat(bot): замена подходов упражнения на экране повтора тренировки"
```

---

### Task 6: `workout/index.ts` — точка входа после `/done` и «Продолжить»

**Files:**
- Modify: `src/handlers/workout/index.ts`

- [ ] **Step 1: Импорты**

Заменить:

```ts
import { typeKeyboard, resumeOrRestartKeyboard, exerciseSavedMenuKeyboard } from './keyboards';
```

на:

```ts
import { typeKeyboard, resumeOrRestartKeyboard, exerciseSavedMenuKeyboard, repeatDoneKeyboard } from './keyboards';
```

Заменить:

```ts
} from './cardioStep';
import { saveDraftWorkout } from './finish';
```

на:

```ts
} from './cardioStep';
import { saveDraftWorkout } from './finish';
import { renderRepeatReview } from './repeatStep';
```

- [ ] **Step 2: Кнопка «Повторить это» после `/done`**

Заменить:

```ts
async function handleDoneCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) {
    await ctx.reply('Нет активной тренировки. Начни с /new_workout');
    return;
  }

  const result = await saveDraftWorkout(userId);
  await ctx.reply(result.text);
}
```

на:

```ts
async function handleDoneCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) {
    await ctx.reply('Нет активной тренировки. Начни с /new_workout');
    return;
  }

  const result = await saveDraftWorkout(userId);
  if (result.ok && result.type === 'strength') {
    await ctx.reply(result.text, { reply_markup: repeatDoneKeyboard(result.workoutId) });
  } else {
    await ctx.reply(result.text);
  }
}
```

- [ ] **Step 3: То же для кнопки «✅ Завершить тренировку» (`w:finish`)**

Заменить:

```ts
async function handleFinishAction(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  const result = await saveDraftWorkout(userId);
  await ctx.editMessageText(result.text);
}
```

на:

```ts
async function handleFinishAction(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const draft = getDraft(userId);
  if (!draft) return;

  const result = await saveDraftWorkout(userId);
  if (result.ok && result.type === 'strength') {
    await ctx.editMessageText(result.text, { reply_markup: repeatDoneKeyboard(result.workoutId) });
  } else {
    await ctx.editMessageText(result.text);
  }
}
```

- [ ] **Step 4: Перерисовка экрана повтора по «▶️ Продолжить»**

Заменить:

```ts
    case 'cardio_saved_menu':
      await finalizeCardioBlock(ctx, userId, true);
      return;
    default:
      return;
  }
}
```

на:

```ts
    case 'cardio_saved_menu':
      await finalizeCardioBlock(ctx, userId, true);
      return;
    case 'reviewing_repeat':
      await renderRepeatReview(ctx, draft, true);
      return;
    default:
      return;
  }
}
```

- [ ] **Step 5: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/handlers/workout/index.ts
git commit -m "feat(bot): кнопка «Повторить это» после /done и резюме экрана повтора"
```

---

### Task 7: Кнопка «Повторить» на карточке в `/history`

**Files:**
- Modify: `src/handlers/history.ts`
- Modify: `src/handlers/workout/editStep.ts`

Оба файла меняются в одной задаче, потому что `workoutCardKeyboard` получает новый обязательный параметр — если поменять только один файл, второй перестанет компилироваться до следующего коммита.

- [ ] **Step 1: `workoutCardKeyboard` получает `type` и условную кнопку**

В `src/handlers/history.ts` заменить:

```ts
import { Workout, Exercise, CardioSession } from '../types/domain';
```

на:

```ts
import { Workout, Exercise, CardioSession, WorkoutType } from '../types/domain';
```

Заменить:

```ts
export function workoutCardKeyboard(workoutId: string, offset: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✏️ Изменить', `we:${workoutId}:${offset}`),
      Markup.button.callback('🗑 Удалить', `wd:${workoutId}:${offset}`),
    ],
  ]).reply_markup;
}
```

на:

```ts
export function workoutCardKeyboard(workoutId: string, offset: number, type: WorkoutType) {
  const rows = [
    [
      Markup.button.callback('✏️ Изменить', `we:${workoutId}:${offset}`),
      Markup.button.callback('🗑 Удалить', `wd:${workoutId}:${offset}`),
    ],
  ];
  if (type === 'strength') {
    rows.push([Markup.button.callback('🔁 Повторить', `w:repeat:${workoutId}`)]);
  }
  return Markup.inlineKeyboard(rows).reply_markup;
}
```

- [ ] **Step 2: Обновить вызов в `sendHistoryPage`**

В `src/handlers/history.ts` заменить:

```ts
    const text = formatWorkoutCardText(workout, ownExercises, cardioByWorkout.get(workout.id));
    await ctx.reply(text, { reply_markup: workoutCardKeyboard(workout.id, offset) });
```

на:

```ts
    const text = formatWorkoutCardText(workout, ownExercises, cardioByWorkout.get(workout.id));
    await ctx.reply(text, { reply_markup: workoutCardKeyboard(workout.id, offset, workout.type) });
```

- [ ] **Step 3: Обновить вызов в `renderCardById` (`editStep.ts`)**

В `src/handlers/workout/editStep.ts` заменить:

```ts
  const text = formatWorkoutCardText(workout, exercises, cardioSessions[0]);
  await ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
    reply_markup: workoutCardKeyboard(workoutId, offset),
  });
}
```

на:

```ts
  const text = formatWorkoutCardText(workout, exercises, cardioSessions[0]);
  await ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
    reply_markup: workoutCardKeyboard(workoutId, offset, workout.type),
  });
}
```

(Это внутри `renderCardById`, где `workout` уже получен через `getWorkoutOwned` несколькими строками выше — переменная уже в области видимости, новый запрос не нужен.)

- [ ] **Step 4: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/handlers/history.ts src/handlers/workout/editStep.ts
git commit -m "feat(bot): кнопка «Повторить» на карточке тренировки в /history"
```

---

### Task 8: Регистрация обработчика

**Files:**
- Modify: `src/botInstance.ts`

- [ ] **Step 1: Импортировать и зарегистрировать `registerWorkoutRepeat`**

Заменить:

```ts
import { Telegraf } from 'telegraf';
import { config } from './config';
import { registerStart } from './handlers/start';
import { registerHistory } from './handlers/history';
import { registerProgress } from './handlers/progress';
import { registerExport } from './handlers/export';
import { registerWorkout } from './handlers/workout';
import { registerWorkoutEdit } from './handlers/workout/editStep';
import { registerSettings } from './handlers/settings';
import { registerWebApp } from './handlers/webapp';

export const bot = new Telegraf(config.BOT_TOKEN);

registerStart(bot);
registerWorkout(bot);
registerWorkoutEdit(bot);
registerHistory(bot);
registerProgress(bot);
registerExport(bot);
registerSettings(bot);
registerWebApp(bot);
```

на:

```ts
import { Telegraf } from 'telegraf';
import { config } from './config';
import { registerStart } from './handlers/start';
import { registerHistory } from './handlers/history';
import { registerProgress } from './handlers/progress';
import { registerExport } from './handlers/export';
import { registerWorkout } from './handlers/workout';
import { registerWorkoutEdit } from './handlers/workout/editStep';
import { registerWorkoutRepeat } from './handlers/workout/repeatStep';
import { registerSettings } from './handlers/settings';
import { registerWebApp } from './handlers/webapp';

export const bot = new Telegraf(config.BOT_TOKEN);

registerStart(bot);
registerWorkout(bot);
registerWorkoutEdit(bot);
registerWorkoutRepeat(bot);
registerHistory(bot);
registerProgress(bot);
registerExport(bot);
registerSettings(bot);
registerWebApp(bot);
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/botInstance.ts
git commit -m "feat(bot): зарегистрировать обработчик повтора тренировки"
```

---

### Task 9: Полная сборка, ручной прогон, деплой

**Files:** нет изменений — только верификация.

- [ ] **Step 1: Полная сборка проекта**

Run: `npm run build`
Expected: exit code 0 (компилирует бэкенд `tsc`, затем ставит и собирает `webapp` — `webapp` в этой фиче не менялся, но сборка всего проекта должна оставаться зелёной).

- [ ] **Step 2: Ручной прогон в реальном боте (dogfood)**

Согласовать с пользователем, что Render-инстанс можно ненадолго конфликтовать при локальном запуске, либо тестировать сразу после деплоя (см. Step 3). Прогнать:

1. Сохранить силовую тренировку с 2–3 упражнениями через `/new_workout` → `/done`. В сообщении с итогом должна появиться кнопка «🔁 Повторить это».
2. Тапнуть её — должен показаться экран-превью с теми же упражнениями и подходами, заголовок с датой исходной тренировки.
3. Открыть `/history` — на карточке более старой силовой тренировки тоже должна быть кнопка «🔁 Повторить», рядом с «✏️ Изменить»/«🗑 Удалить». Тапнуть — тот же экран-превью.
4. На экране превью: тапнуть «✏️» на одном упражнении → ввести новые подходы → убедиться, что они заменились (не задвоились), и снова показан экран превью со всеми упражнениями.
5. На том же экране: ввести заведомо невалидную строку подходов (например `abc`) при замене — должна показаться ошибка с кнопкой «❌ Отмена», ведущей обратно на экран превью (не в общий выбор упражнения).
6. Тапнуть «🗑» на одном упражнении — оно должно пропасть из списка, остальные не сбиться по порядку.
7. Тапнуть «➕ Добавить упражнение», выбрать любое, ввести подходы — должно попасть в обычное меню «Ещё подход / Следующее упражнение / Завершить» со всеми упражнениями (включая предзаполненные) в списке «Ранее в тренировке».
8. Тапнуть «✅ Завершить тренировку» — проверить итоговую запись в `/history` (правильные упражнения/подходы, сегодняшняя дата).
9. Повторить ещё раз, но в этот раз тапнуть «❌ Отменить» — черновик должен очиститься, ничего не сохраниться, повторный `/new_workout` не должен предлагать «Продолжить» уже отменённый черновик.
10. Проверить блокировку конфликта: начать `/new_workout`, не завершая (остаться на любом шаге) → тапнуть «🔁 Повторить» на карточке из истории → должно показать сообщение о незавершённой тренировке, а не сломать текущий черновик.
11. Проверить, что для кардио/бассейна/смешанной тренировки кнопка «Повторить» не показывается ни после `/done`, ни в `/history`.
12. Начать повтор, свернуть чат, вернуться и тапнуть «▶️ Продолжить» (если появится после долгой паузы) — экран превью должен перерисоваться корректно, без потери упражнений.

- [ ] **Step 3: Задеплоить**

```bash
git push
```

Render автоматически задеплоит по пушу в `master`. После деплоя повторить ключевые пункты dogfood-прогона (Step 2, особенно пункты 1–4 и 10) уже на проде, если тестировали только локально.

---

## Self-Review

- **Покрытие спека:** «Точка входа» (обе кнопки) → Task 6 Step 2–3 (после `/done`) и Task 7 (в `/history`); «Поток» шаги 1–8 → Task 4 (сборка черновика, ✏️/🗑, отмена) + Task 5 (замена подходов) + переиспользование существующих `handleNextExercise`/`handleFinishAction`/`handleCancelWorkoutAction` без изменений (сознательно не тронуты); «Технические детали» — все перечисленные файлы и функции спека покрыты задачами 1–8; «Тестирование» из спека → Task 9 Step 2 (пункты 1–7 спека соответствуют пунктам 1–11 прогона, плюс добавлен пункт 12 на «Продолжить», не описанный явно в спеке, но логически вытекающий из раздела «Поток» шага, где упомянут `renderCurrentStep`).
- **Плейсхолдеров нет** — каждый шаг содержит точный код или точную команду с ожидаемым результатом; единственное текстовое примечание (Task 4, про неиспользуемый импорт) сразу даёт исправленную строку импорта, а не абстрактное «убрать лишнее».
- **Согласованность типов и имён:** `editingExerciseIndex`/`repeatSourceDate` определены в Task 1 и используются с теми же именами в Task 4 (`repeatStep.ts`) и Task 5 (`setsInputStep.ts`). `renderRepeatReview(ctx, draft, viaEdit)` — сигнатура одинакова во всех трёх местах вызова (Task 4 — внутри самого файла, Task 5 — `false`, Task 6 — `true`). `repeatDoneKeyboard`/`repeatReviewKeyboard`/`repeatEditSetsKeyboard` определены в Task 2 с теми же именами и сигнатурами, что используются в Task 4/5/6. `workoutCardKeyboard(workoutId, offset, type)` — новая сигнатура согласована между Task 7 Step 1 (определение) и Step 2–3 (оба вызова), оба места правятся в одной задаче, чтобы не было промежуточного «красного» коммита.
- **Порядок задач учитывает зависимости импортов:** Task 4 (`repeatStep.ts`) требует Task 1+2; Task 5 (`setsInputStep.ts`) импортирует из `repeatStep.ts` → идёт после Task 4; Task 6 (`index.ts`) использует `repeatDoneKeyboard` (Task 2), `result.type`/`result.workoutId` (Task 3) и `renderRepeatReview` (Task 4) → идёт после всех трёх.
