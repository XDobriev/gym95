/**
 * Telegram Bot API 10.4 HTML Widget for Water Balance Tracker (/water)
 * 
 * Complies with gym95 design system:
 * - Anton font strictly on numbers
 * - Barlow for labels, titles and buttons
 * - Teal #00e0a4 / Lime #c9ff2e styling for water tracking
 * - Animated progress bar
 * - Fully self-contained under 32 KB
 */

export interface WaterWidgetState {
  drunkMl: number;
  targetMl: number;
  workoutBonus?: boolean;
}

export function generateWaterWidgetHtml(options?: {
  initialState?: WaterWidgetState;
}): string {
  const state: WaterWidgetState = {
    drunkMl: options?.initialState?.drunkMl ?? 1500,
    targetMl: options?.initialState?.targetMl ?? 2500,
    workoutBonus: options?.initialState?.workoutBonus ?? false,
  };

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Трекер воды gym95</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Semi+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&display=swap');

    :root {
      --teal: #00e0a4;
      --teal-glow: rgba(0, 224, 164, 0.35);
      --lime: #c9ff2e;
      --bg: #0e1117;
      --card-bg: #141922;
      --border: #232c3a;
      --text: #f0f2f5;
      --text-muted: #8a94a6;
      --orange: #ff7a1a;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-tap-highlight-color: transparent; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Barlow', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 12px;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .widget-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .widget-title {
      font-family: 'Barlow', sans-serif;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .badge-status {
      background: rgba(0, 224, 164, 0.15);
      border: 1px solid var(--teal);
      color: var(--teal);
      padding: 3px 8px;
      border-radius: 6px;
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .badge-status.done {
      background: rgba(201, 255, 46, 0.15);
      border-color: var(--lime);
      color: var(--lime);
    }

    /* Прогресс-бар */
    .progress-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .numbers-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .current-val {
      font-family: 'Anton', sans-serif;
      font-size: 32px;
      color: var(--teal);
      letter-spacing: 0.02em;
      line-height: 1;
    }

    .current-val.done {
      color: var(--lime);
    }

    .target-val {
      font-size: 13px;
      color: var(--text-muted);
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-weight: 600;
    }

    .track {
      width: 100%;
      height: 12px;
      background: #0d131c;
      border-radius: 999px;
      border: 1px solid #1c2534;
      overflow: hidden;
      position: relative;
    }

    .fill {
      height: 100%;
      background: var(--teal);
      border-radius: 999px;
      transition: width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.3s;
      box-shadow: 0 0 10px var(--teal-glow);
    }

    .fill.done {
      background: var(--lime);
      box-shadow: 0 0 12px rgba(201, 255, 46, 0.4);
    }

    .bonus-note {
      font-size: 11px;
      color: var(--lime);
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    /* Кнопки быстрых глотков */
    .taps-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .btn-tap {
      background: #17202c;
      border: 1px solid #273549;
      color: #fff;
      padding: 12px 6px;
      border-radius: 10px;
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      transition: all 0.1s ease;
    }

    .btn-tap:active {
      transform: scale(0.95);
      background: var(--teal);
      color: #05261d;
      border-color: var(--teal);
    }

    .btn-undo {
      background: transparent;
      border: 1px dashed rgba(255, 255, 255, 0.15);
      color: var(--text-muted);
      padding: 8px;
      border-radius: 8px;
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
    }

    .btn-undo:active {
      background: rgba(255, 122, 26, 0.15);
      color: var(--orange);
      border-color: var(--orange);
    }
  </style>
</head>
<body>

  <div class="widget-header">
    <div class="widget-title"><span>💧</span> Водный баланс</div>
    <div class="badge-status" id="ui-badge-status">В ПРОЦЕССЕ</div>
  </div>

  <div class="progress-box">
    <div class="numbers-row">
      <div class="current-val" id="ui-drunk-val">${state.drunkMl} <span style="font-size: 14px; color: var(--text-muted); font-family: 'Barlow', sans-serif;">мл</span></div>
      <div class="target-val">Цель: <span id="ui-target-val">${state.targetMl}</span> мл (<span id="ui-percent-val">0%</span>)</div>
    </div>

    <div class="track">
      <div class="fill" id="ui-progress-fill" style="width: 0%;"></div>
    </div>

    ${state.workoutBonus ? '<div class="bonus-note" id="ui-bonus-note">+0.5 л к норме — сегодня день тренировки ⚡</div>' : ''}
  </div>

  <div class="taps-grid">
    <button class="btn-tap" id="btn-add-250" onclick="addWater(250)">
      <span>+250</span>
      <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">стакан</span>
    </button>
    <button class="btn-tap" id="btn-add-500" onclick="addWater(500)">
      <span>+500</span>
      <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">бутылка</span>
    </button>
    <button class="btn-tap" id="btn-add-750" onclick="addWater(750)">
      <span>+750</span>
      <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">шейкер</span>
    </button>
  </div>

  <button class="btn-undo" id="btn-undo-water" onclick="undoWater()">↩️ Отменить последнюю запись</button>

  <script>
    let state = {
      drunkMl: ${state.drunkMl},
      targetMl: ${state.targetMl},
      workoutBonus: ${state.workoutBonus}
    };

    function render() {
      const pct = Math.min(100, Math.round((state.drunkMl / state.targetMl) * 100));
      const isDone = state.drunkMl >= state.targetMl;

      const drunkEl = document.getElementById('ui-drunk-val');
      drunkEl.innerHTML = state.drunkMl + ' <span style="font-size: 14px; color: var(--text-muted); font-family: \\'Barlow\\', sans-serif;">мл</span>';
      if (isDone) drunkEl.classList.add('done');
      else drunkEl.classList.remove('done');

      document.getElementById('ui-target-val').innerText = state.targetMl;
      document.getElementById('ui-percent-val').innerText = pct + '%';

      const fill = document.getElementById('ui-progress-fill');
      fill.style.width = pct + '%';
      if (isDone) fill.classList.add('done');
      else fill.classList.remove('done');

      const badge = document.getElementById('ui-badge-status');
      if (isDone) {
        badge.innerText = 'НОРМА ВЫПОЛНЕНА ✓';
        badge.classList.add('done');
      } else {
        badge.innerText = 'В ПРОЦЕССЕ';
        badge.classList.remove('done');
      }

      if (window.__gym95_onWaterUpdate) {
        window.__gym95_onWaterUpdate(state, pct, isDone);
      }
    }

    function addWater(amount) {
      state.drunkMl = Math.min(6000, state.drunkMl + amount);
      render();
      notifyBot({ action: 'water_add', amount: amount });
    }

    function undoWater() {
      notifyBot({ action: 'water_undo' });
    }

    function notifyBot(payload) {
      if (typeof TelegramWidget !== 'undefined' && TelegramWidget.request) {
        TelegramWidget.request(payload);
      }
    }

    if (typeof TelegramWidget !== 'undefined' && TelegramWidget.onEvent) {
      TelegramWidget.onEvent('chatDataChanged', function(newData) {
        try {
          const parsed = typeof newData === 'string' ? JSON.parse(newData) : newData;
          if (parsed && typeof parsed.drunkMl === 'number') {
            state.drunkMl = parsed.drunkMl;
            if (typeof parsed.targetMl === 'number') state.targetMl = parsed.targetMl;
            render();
          }
        } catch(e) {}
      });
    }

    window.__gym95_setWaterState = function(s) {
      if (s.drunkMl !== undefined) state.drunkMl = s.drunkMl;
      if (s.targetMl !== undefined) state.targetMl = s.targetMl;
      render();
    };

    render();
  </script>
</body>
</html>`;
}
