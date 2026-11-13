import { LiveWorkoutWidgetState, serializeWidgetData } from '../utils/telegramWidgets';

export interface GenerateWidgetOptions {
  initialState?: Partial<LiveWorkoutWidgetState>;
  title?: string;
}

/**
 * Returns self-contained HTML (under 32 KB) for Telegram Bot API 10.4 Live Workout Widget.
 * Adheres strictly to gym95 design system (Anton, Barlow, lime #c9ff2e, dark gym palette).
 */
export function generateLiveWorkoutWidgetHtml(options: GenerateWidgetOptions = {}): string {
  const defaultState: LiveWorkoutWidgetState = {
    wid: options.initialState?.wid || 'w_default',
    ex: options.initialState?.ex || options.title || 'Жим лёжа на скамье',
    sn: options.initialState?.sn ?? 1,
    st: options.initialState?.st ?? 4,
    w: options.initialState?.w ?? 80,
    r: options.initialState?.r ?? 10,
    pw: options.initialState?.pw ?? 77.5,
    pr: options.initialState?.pr ?? 10,
    m: options.initialState?.m ?? 'active',
    rd: options.initialState?.rd ?? 90,
    rta: options.initialState?.rta,
    completedSets: options.initialState?.completedSets ?? [],
  };

  const initialJson = JSON.stringify(defaultState);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>gym95 Live Workout</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Semi+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --lime: #c9ff2e;
      --lime-ink: #0a1400;
      --lime-glow: rgba(201, 255, 46, 0.35);
      --teal: #00e0a4;
      --orange: #ff7a1a;
      --bg: #131922;
      --card-bg: #181d24;
      --card-border: #232c3a;
      --text-main: #f0f2f5;
      --text-muted: #8a94a6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-tap-highlight-color: transparent; }
    body {
      background: var(--bg);
      color: var(--text-main);
      font-family: 'Barlow', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 12px;
      margin: 0;
      overflow-x: hidden;
    }
    .widget-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 14px;
      max-width: 420px;
      margin: 0 auto;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      gap: 8px;
    }
    .title-col { flex: 1; }
    .ex-title {
      font-family: 'Barlow', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 700;
      font-size: 18px;
      letter-spacing: 0.01em;
      color: #ffffff;
      text-transform: uppercase;
      line-height: 1.2;
      word-break: break-word;
    }
    .badge {
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 8px;
      white-space: nowrap;
    }
    .badge-lime {
      background: rgba(201, 255, 46, 0.15);
      border: 1px solid var(--lime);
      color: var(--lime);
    }
    .badge-teal {
      background: rgba(0, 224, 164, 0.15);
      border: 1px solid var(--teal);
      color: var(--teal);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .control-box {
      background: #11161e;
      border: 1px solid #202836;
      border-radius: 12px;
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .control-label {
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .control-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
    }
    .step-btn {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #1e2634;
      border: 1px solid #2d384c;
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.1s ease, background 0.15s ease;
    }
    .step-btn:active {
      transform: scale(0.92);
      background: var(--lime);
      color: var(--lime-ink);
      border-color: var(--lime);
    }
    .val-display {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 2px;
      min-width: 54px;
      text-align: center;
    }
    .val-num {
      font-family: 'Anton', sans-serif;
      font-size: 26px;
      color: var(--lime);
      line-height: 1;
    }
    .val-unit {
      font-size: 11px;
      color: var(--text-muted);
    }
    .ghost-hint {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 2px;
      font-family: 'Barlow', sans-serif;
    }
    .timer-banner {
      background: rgba(201, 255, 46, 0.06);
      border: 1px dashed rgba(201, 255, 46, 0.3);
      border-radius: 12px;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .timer-banner-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .t-lbl {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      font-family: 'Barlow Semi Condensed', sans-serif;
    }
    .t-val {
      font-family: 'Anton', sans-serif;
      font-size: 18px;
      color: #ffffff;
    }
    .btn-quick-add {
      background: #1e2634;
      border: 1px solid #2d384c;
      color: var(--lime);
      font-size: 11px;
      font-weight: 700;
      padding: 5px 9px;
      border-radius: 6px;
      cursor: pointer;
      font-family: 'Barlow Semi Condensed', sans-serif;
    }
    .btn-quick-add:active {
      background: var(--lime);
      color: var(--lime-ink);
    }
    .btn-primary {
      width: 100%;
      height: 48px;
      background: var(--lime);
      color: var(--lime-ink);
      border: none;
      border-radius: 12px;
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 4px 14px var(--lime-glow);
      transition: transform 0.1s ease, filter 0.15s ease;
    }
    .btn-primary:active {
      transform: scale(0.98);
      filter: brightness(0.92);
    }
    .btn-secondary {
      width: 100%;
      height: 42px;
      background: #1e2634;
      color: #ffffff;
      border: 1px solid #2d384c;
      border-radius: 12px;
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-secondary:active {
      background: #273142;
    }
    /* Resting Mode View */
    .rest-hero {
      text-align: center;
      padding: 16px 0;
    }
    .rest-countdown {
      font-family: 'Anton', sans-serif;
      font-size: 46px;
      color: var(--teal);
      letter-spacing: 0.03em;
      line-height: 1;
      margin: 8px 0;
      text-shadow: 0 0 16px rgba(0, 224, 164, 0.4);
    }
    .rest-sub {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-family: 'Barlow Semi Condensed', sans-serif;
      letter-spacing: 0.05em;
    }
    .rest-actions-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 14px;
    }
    /* Done Mode View */
    .done-summary {
      background: #11161e;
      border: 1px solid #202836;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .done-stats-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .done-stat-val {
      font-family: 'Anton', sans-serif;
      font-size: 20px;
      color: var(--lime);
    }
    .done-sets-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: var(--text-main);
    }
    .done-set-item {
      display: flex;
      justify-content: space-between;
      color: var(--text-muted);
    }
    .done-set-item strong {
      color: var(--text-main);
    }
  </style>
</head>
<body>
  <div class="widget-card" id="widget-card">
    <!-- Header -->
    <div class="header">
      <div class="title-col">
        <div class="ex-title" id="ui-ex-title">${defaultState.ex}</div>
      </div>
      <div id="ui-header-badge" class="badge badge-lime">СЕТ #${defaultState.sn}</div>
    </div>

    <!-- Mode 1: Active Set Entry -->
    <div id="view-active" style="display: ${defaultState.m === 'active' ? 'block' : 'none'};">
      <div class="grid">
        <!-- Weight Stepper -->
        <div class="control-box">
          <span class="control-label">Вес снаряда</span>
          <div class="control-row">
            <button class="step-btn" id="btn-w-dec" onclick="stepWeight(-2.5)" aria-label="Уменьшить вес">−</button>
            <div class="val-display">
              <span class="val-num" id="val-weight">${defaultState.w}</span>
              <span class="val-unit">кг</span>
            </div>
            <button class="step-btn" id="btn-w-inc" onclick="stepWeight(2.5)" aria-label="Увеличить вес">+</button>
          </div>
          <div class="ghost-hint" id="hint-weight">${defaultState.pw ? `Прошлый: ${defaultState.pw} кг` : ''}</div>
        </div>

        <!-- Reps Stepper -->
        <div class="control-box">
          <span class="control-label">Повторения</span>
          <div class="control-row">
            <button class="step-btn" id="btn-r-dec" onclick="stepReps(-1)" aria-label="Уменьшить повторения">−</button>
            <div class="val-display">
              <span class="val-num" id="val-reps">${defaultState.r}</span>
              <span class="val-unit">повт</span>
            </div>
            <button class="step-btn" id="btn-r-inc" onclick="stepReps(1)" aria-label="Увеличить повторения">+</button>
          </div>
          <div class="ghost-hint" id="hint-reps">${defaultState.pr ? `Прошлый: ${defaultState.pr} повт` : ''}</div>
        </div>
      </div>

      <!-- Rest Info Banner -->
      <div class="timer-banner">
        <div class="timer-banner-info">
          <span style="font-size: 16px;">⏱</span>
          <div>
            <div class="t-lbl">Запланирован отдых</div>
            <div class="t-val" id="ui-planned-rest">${defaultState.rd ?? 90} сек</div>
          </div>
        </div>
        <button class="btn-quick-add" id="btn-add-rest-30" onclick="quickAddRest(30)">+30 сек</button>
      </div>

      <!-- Main Action CTA -->
      <button class="btn-primary" id="btn-finish-set" onclick="actionFinishSet()">
        <span>✓</span> ЗАВЕРШИТЬ ПОДХОД
      </button>
    </div>

    <!-- Mode 2: Resting View -->
    <div id="view-resting" style="display: ${defaultState.m === 'resting' ? 'block' : 'none'};">
      <div class="rest-hero">
        <div class="rest-sub">Отдых между подходами</div>
        <div class="rest-countdown" id="ui-rest-countdown">01:30</div>
        <div class="rest-sub" id="ui-next-set-label">Следующий сет: #${defaultState.sn + 1}</div>
      </div>
      <div class="rest-actions-row">
        <button class="btn-secondary" id="btn-resting-add-30" onclick="quickAddRest(30)">+30 сек</button>
        <button class="btn-primary" id="btn-skip-rest" style="height: 42px;" onclick="actionSkipRest()">⚡ Начать подход</button>
      </div>
      <button class="btn-secondary" id="btn-finish-exercise-early" style="margin-top: 8px;" onclick="actionFinishExerciseEarly()">✓ Завершить упражнение</button>
    </div>

    <!-- Mode 3: Done Summary View -->
    <div id="view-done" style="display: ${defaultState.m === 'done' ? 'block' : 'none'};">
      <div class="done-summary">
        <div class="done-stats-row">
          <span class="control-label">Итог упражнения</span>
          <span class="done-stat-val" id="ui-done-tonnage">0 кг</span>
        </div>
        <div class="done-sets-list" id="ui-done-sets-list"></div>
      </div>
      <button class="btn-secondary" id="btn-add-more-set" style="margin-bottom: 8px;" onclick="actionAddMoreSet()">+ Ещё подход</button>
      <button class="btn-primary" id="btn-next-exercise" onclick="actionNextExercise()">➡️ Следующее упражнение</button>
      <button class="btn-secondary" id="btn-finish-workout" onclick="actionFinishWorkout()">🏁 Завершить тренировку</button>
    </div>
  </div>

  <script>
    // Initial state initialized from server bundle
    var state = ${initialJson};
    var timerInterval = null;

    // Synchronize state with TelegramWidget context if provided
    if (window.TelegramWidget && window.TelegramWidget.initData) {
      try {
        var parsed = JSON.parse(window.TelegramWidget.initData);
        if (parsed && typeof parsed === 'object') {
          Object.assign(state, parsed);
        }
      } catch (e) {}
    }

    // Subscribe to external updates from bot
    if (window.TelegramWidget && window.TelegramWidget.onEvent) {
      window.TelegramWidget.onEvent('chatDataChanged', function(data) {
        if (!data) return;
        try {
          var updated = typeof data === 'string' ? JSON.parse(data) : data;
          Object.assign(state, updated);
          render();
        } catch (err) {}
      });
    }

    function emitAction(payload) {
      window.__gym95_lastAction = payload;
      try {
        var ev = new CustomEvent('gym95:action', { detail: payload });
        window.dispatchEvent(ev);
      } catch (e) {}

      if (window.TelegramWidget && window.TelegramWidget.request) {
        window.TelegramWidget.request(payload);
      }
    }

    function stepWeight(delta) {
      var next = Math.max(0, Math.round((state.w + delta) * 10) / 10);
      state.w = next;
      var el = document.getElementById('val-weight');
      if (el) el.innerText = state.w;
    }

    function stepReps(delta) {
      var next = Math.max(1, Math.round(state.r + delta));
      state.r = next;
      var el = document.getElementById('val-reps');
      if (el) el.innerText = state.r;
    }

    function quickAddRest(sec) {
      state.rd = (state.rd || 90) + sec;
      if (state.m === 'resting' && state.rta) {
        state.rta += sec * 1000;
      }
      var el = document.getElementById('ui-planned-rest');
      if (el) el.innerText = state.rd + ' сек';
      emitAction({ action: 'add_rest', restAdded: sec });
    }

    function actionFinishSet() {
      if (!state.completedSets) state.completedSets = [];
      state.completedSets.push({ w: state.w, r: state.r });

      var finishedSetIndex = state.sn;
      state.pw = state.w;
      state.pr = state.r;

      emitAction({
        action: 'finish_set',
        weight: state.w,
        reps: state.r,
        setIndex: finishedSetIndex
      });

      // Switch to resting or done locally
      if (state.sn >= state.st) {
        state.m = 'done';
      } else {
        state.m = 'resting';
        state.sn += 1;
        state.rta = Date.now() + (state.rd || 90) * 1000;
      }
      render();
    }

    function actionSkipRest() {
      emitAction({ action: 'skip_rest' });
      state.m = 'active';
      render();
    }

    function actionFinishExerciseEarly() {
      state.m = 'done';
      render();
      emitAction({ action: 'finish_exercise' });
    }

    function actionAddMoreSet() {
      state.st = Math.max(state.st, state.sn) + 1;
      state.sn = (state.completedSets ? state.completedSets.length : 0) + 1;
      state.m = 'active';
      render();
      emitAction({ action: 'add_set' });
    }

    function actionNextExercise() {
      emitAction({ action: 'next_exercise' });
    }

    function actionFinishWorkout() {
      emitAction({ action: 'finish_workout' });
    }

    function formatTime(totalSec) {
      var m = Math.floor(totalSec / 60);
      var s = totalSec % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function updateRestTimer() {
      if (state.m !== 'resting') return;
      var remaining = Math.max(0, Math.ceil(((state.rta || Date.now()) - Date.now()) / 1000));
      var timerEl = document.getElementById('ui-rest-countdown');
      if (timerEl) {
        timerEl.innerText = formatTime(remaining);
      }
      if (remaining <= 0) {
        if (timerEl) {
          timerEl.style.color = 'var(--lime)';
          timerEl.innerText = '00:00';
        }
      }
    }

    function render() {
      // Header
      var titleEl = document.getElementById('ui-ex-title');
      if (titleEl) titleEl.innerText = state.ex;

      var badgeEl = document.getElementById('ui-header-badge');
      if (badgeEl) {
        if (state.m === 'active') {
          badgeEl.className = 'badge badge-lime';
          badgeEl.innerText = 'СЕТ #' + state.sn + (state.st ? ' / ' + state.st : '');
        } else if (state.m === 'resting') {
          badgeEl.className = 'badge badge-teal';
          badgeEl.innerText = 'ОТДЫХ';
        } else {
          badgeEl.className = 'badge badge-lime';
          badgeEl.innerText = 'ВЫПОЛНЕНО ✓';
        }
      }

      // Views
      var viewActive = document.getElementById('view-active');
      var viewResting = document.getElementById('view-resting');
      var viewDone = document.getElementById('view-done');

      if (viewActive) viewActive.style.display = state.m === 'active' ? 'block' : 'none';
      if (viewResting) viewResting.style.display = state.m === 'resting' ? 'block' : 'none';
      if (viewDone) viewDone.style.display = state.m === 'done' ? 'block' : 'none';

      // Active values
      var wEl = document.getElementById('val-weight');
      if (wEl) wEl.innerText = state.w;
      var rEl = document.getElementById('val-reps');
      if (rEl) rEl.innerText = state.r;

      var hintW = document.getElementById('hint-weight');
      if (hintW) hintW.innerText = state.pw ? 'Прошлый: ' + state.pw + ' кг' : '';
      var hintR = document.getElementById('hint-reps');
      if (hintR) hintR.innerText = state.pr ? 'Прошлый: ' + state.pr + ' повт' : '';

      var restPlanEl = document.getElementById('ui-planned-rest');
      if (restPlanEl) restPlanEl.innerText = (state.rd || 90) + ' сек';

      var nextSetEl = document.getElementById('ui-next-set-label');
      if (nextSetEl) nextSetEl.innerText = 'Следующий сет: #' + state.sn;

      var timerEl = document.getElementById('ui-rest-countdown');
      if (timerEl && state.m === 'resting') {
        var remaining = Math.max(0, Math.ceil(((state.rta || Date.now()) - Date.now()) / 1000));
        timerEl.style.color = remaining <= 0 ? 'var(--lime)' : 'var(--teal)';
      }

      // Done stats
      if (state.m === 'done' && state.completedSets) {
        var totalTonnage = state.completedSets.reduce(function(acc, s) { return acc + (s.w * s.r); }, 0);
        var tonEl = document.getElementById('ui-done-tonnage');
        if (tonEl) tonEl.innerText = totalTonnage.toLocaleString('ru-RU') + ' кг';

        var listEl = document.getElementById('ui-done-sets-list');
        if (listEl) {
          listEl.innerHTML = state.completedSets.map(function(s, idx) {
            return '<div class="done-set-item"><span>Сет ' + (idx + 1) + ':</span><strong>' + s.w + ' кг × ' + s.r + '</strong></div>';
          }).join('');
        }
      }

      // Timer management
      if (state.m === 'resting') {
        if (!timerInterval) {
          updateRestTimer();
          timerInterval = setInterval(updateRestTimer, 500);
        }
      } else {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
      }
    }

    // Expose helpers for testing & Playwright automation
    window.__gym95_getState = function() { return state; };
    window.__gym95_setState = function(next) { Object.assign(state, next); render(); };
    window.__gym95_render = render;

    // Initial render
    render();
  </script>
</body>
</html>`;
}
