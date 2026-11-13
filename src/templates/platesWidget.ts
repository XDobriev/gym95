/**
 * Telegram Bot API 10.4 HTML Widget for Barbell Plates Calculator (/plates and /calc)
 * 
 * Complies with gym95 design system:
 * - Anton font strictly on numbers
 * - Barlow for labels, titles and buttons
 * - Toxic lime #c9ff2e accent
 * - Olympic colored plates
 * - Fully self-contained under 32 KB
 */

export interface PlatesWidgetState {
  targetWeight: number; // e.g. 100
  barWeight: number; // 20, 15, 10
}

export function generatePlatesWidgetHtml(options?: {
  initialState?: PlatesWidgetState;
}): string {
  const state: PlatesWidgetState = {
    targetWeight: options?.initialState?.targetWeight ?? 100,
    barWeight: options?.initialState?.barWeight ?? 20,
  };

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Калькулятор блинов gym95</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Semi+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&display=swap');

    :root {
      --lime: #c9ff2e;
      --lime-ink: #0a1400;
      --lime-glow: rgba(201, 255, 46, 0.35);
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
    }

    .badge-weight {
      background: rgba(201, 255, 46, 0.15);
      border: 1px solid var(--lime);
      color: var(--lime);
      padding: 3px 8px;
      border-radius: 6px;
      font-family: 'Anton', sans-serif;
      font-size: 15px;
      letter-spacing: 0.02em;
    }

    /* Визуализатор штанги */
    .barbell-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 84px;
      position: relative;
      overflow: hidden;
    }

    .barbell-shaft {
      position: absolute;
      width: 94%;
      height: 8px;
      background: linear-gradient(180deg, #b0bec5 0%, #78909c 100%);
      border-radius: 4px;
      z-index: 1;
    }

    .plates-cluster {
      display: flex;
      align-items: center;
      gap: 3px;
      z-index: 2;
    }

    .plate {
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Anton', sans-serif;
      font-size: 10px;
      box-shadow: 2px 0 4px rgba(0,0,0,0.5);
      transition: all 0.2s ease;
    }

    .plate-25   { width: 13px; height: 64px; background: #e53935; color: #fff; }
    .plate-20   { width: 12px; height: 58px; background: #1e88e5; color: #fff; }
    .plate-15   { width: 11px; height: 50px; background: #fdd835; color: #111; }
    .plate-10   { width: 10px; height: 42px; background: #43a047; color: #fff; }
    .plate-5    { width: 9px;  height: 34px; background: #f5f5f5; color: #111; }
    .plate-25s  { width: 8px;  height: 26px; background: #424242; color: #fff; font-size: 8px; }
    .plate-125s { width: 7px;  height: 20px; background: #90a4ae; color: #111; font-size: 7px; }

    .collar {
      width: 6px;
      height: 18px;
      background: var(--orange);
      border-radius: 2px;
      z-index: 3;
    }

    .bar-center-label {
      width: 68px;
      text-align: center;
      z-index: 2;
      font-family: 'Anton', sans-serif;
      font-size: 13px;
      color: #fff;
      background: rgba(14, 17, 23, 0.7);
      padding: 2px 4px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .side-info {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    .side-info strong {
      color: #fff;
      font-family: 'Anton', sans-serif;
      font-size: 14px;
      letter-spacing: 0.02em;
    }

    /* Панель управления весом */
    .controls-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .stepper-row {
      display: grid;
      grid-template-columns: 1fr 1fr 2fr 1fr 1fr;
      gap: 6px;
      align-items: center;
    }

    .btn-step {
      background: #1a222e;
      border: 1px solid #2d384b;
      color: #fff;
      padding: 10px 0;
      border-radius: 8px;
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.1s ease;
    }

    .btn-step:active {
      transform: scale(0.94);
      background: var(--lime);
      color: var(--lime-ink);
      border-color: var(--lime);
    }

    .target-display {
      text-align: center;
      background: #121822;
      border: 1px solid #283344;
      border-radius: 8px;
      padding: 6px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .target-num {
      font-family: 'Anton', sans-serif;
      font-size: 24px;
      color: var(--lime);
      line-height: 1;
    }

    .target-unit {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-weight: 600;
    }

    /* Выбор грифа */
    .bars-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }

    .btn-bar {
      background: #171f2b;
      border: 1px solid #263345;
      color: var(--text-muted);
      padding: 8px 4px;
      border-radius: 8px;
      font-family: 'Barlow Semi Condensed', sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
    }

    .btn-bar.active {
      background: rgba(201, 255, 46, 0.15);
      border-color: var(--lime);
      color: var(--lime);
      box-shadow: 0 0 10px var(--lime-glow);
    }

    /* Пресеты */
    .presets-row {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .btn-preset {
      flex: 1;
      background: #151c27;
      border: 1px solid #263345;
      color: #b0bac8;
      padding: 6px 0;
      border-radius: 6px;
      font-family: 'Anton', sans-serif;
      font-size: 13px;
      cursor: pointer;
      text-align: center;
      transition: all 0.1s ease;
      white-space: nowrap;
    }

    .btn-preset:active {
      background: var(--lime);
      color: var(--lime-ink);
      border-color: var(--lime);
    }
  </style>
</head>
<body>

  <div class="widget-header">
    <div class="widget-title">Раскладка блинов</div>
    <div class="badge-weight" id="ui-target-badge">${state.targetWeight} КГ</div>
  </div>

  <div class="barbell-container">
    <div class="barbell-shaft"></div>
    <div class="plates-cluster" id="plates-left"></div>
    <div class="bar-center-label" id="ui-bar-label">ГРИФ ${state.barWeight}</div>
    <div class="plates-cluster" id="plates-right"></div>
  </div>

  <div class="side-info" id="ui-side-info">
    На каждую сторону: <strong id="ui-side-weight">40 кг</strong>
  </div>

  <div class="controls-panel">
    <div class="stepper-row">
      <button class="btn-step" id="btn-dec-5" onclick="changeWeight(-5)">−5</button>
      <button class="btn-step" id="btn-dec-25" onclick="changeWeight(-2.5)">−2.5</button>
      <div class="target-display">
        <span class="target-num" id="ui-target-val">${state.targetWeight}</span>
        <span class="target-unit">кг</span>
      </div>
      <button class="btn-step" id="btn-inc-25" onclick="changeWeight(+2.5)">+2.5</button>
      <button class="btn-step" id="btn-inc-5" onclick="changeWeight(+5)">+5</button>
    </div>

    <div class="bars-row">
      <button class="btn-bar ${state.barWeight === 20 ? 'active' : ''}" id="btn-bar-20" onclick="setBarWeight(20)">Гриф 20 кг</button>
      <button class="btn-bar ${state.barWeight === 15 ? 'active' : ''}" id="btn-bar-15" onclick="setBarWeight(15)">Гриф 15 кг</button>
      <button class="btn-bar ${state.barWeight === 10 ? 'active' : ''}" id="btn-bar-10" onclick="setBarWeight(10)">Гриф 10 кг</button>
    </div>

    <div class="presets-row">
      <button class="btn-preset" onclick="setPreset(60)">60</button>
      <button class="btn-preset" onclick="setPreset(80)">80</button>
      <button class="btn-preset" onclick="setPreset(100)">100</button>
      <button class="btn-preset" onclick="setPreset(120)">120</button>
      <button class="btn-preset" onclick="setPreset(140)">140</button>
    </div>
  </div>

  <script>
    const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
    const PLATE_CLASSES = {
      25: 'plate-25',
      20: 'plate-20',
      15: 'plate-15',
      10: 'plate-10',
      5: 'plate-5',
      2.5: 'plate-25s',
      1.25: 'plate-125s'
    };

    let state = {
      targetWeight: ${state.targetWeight},
      barWeight: ${state.barWeight}
    };

    function calculatePlates(targetWeight, barWeight) {
      const weightOnBar = Math.max(0, targetWeight - barWeight);
      const targetPerSide = weightOnBar / 2;
      let remaining = targetPerSide;
      const plates = [];

      for (const p of DEFAULT_PLATES) {
        while (remaining >= p) {
          plates.push(p);
          remaining = Math.round((remaining - p) * 100) / 100;
        }
      }

      return {
        sideWeight: targetPerSide,
        plates: plates,
        remainder: Math.round(remaining * 2 * 100) / 100
      };
    }

    function render() {
      document.getElementById('ui-target-badge').innerText = state.targetWeight + ' КГ';
      document.getElementById('ui-target-val').innerText = state.targetWeight;
      document.getElementById('ui-bar-label').innerText = 'ГРИФ ' + state.barWeight;

      [10, 15, 20].forEach(b => {
        const el = document.getElementById('btn-bar-' + b);
        if (el) {
          if (b === state.barWeight) el.classList.add('active');
          else el.classList.remove('active');
        }
      });

      const res = calculatePlates(state.targetWeight, state.barWeight);
      const remainderNote = res.remainder > 0 ? ' (остаток ' + res.remainder + ' кг)' : '';
      document.getElementById('ui-side-weight').innerText = res.sideWeight + ' кг' + remainderNote;

      let leftHtml = '';
      res.plates.forEach(p => {
        leftHtml += '<div class="plate ' + PLATE_CLASSES[p] + '">' + p + '</div>';
      });
      leftHtml += '<div class="collar"></div>';

      let rightHtml = '<div class="collar"></div>';
      res.plates.slice().reverse().forEach(p => {
        rightHtml += '<div class="plate ' + PLATE_CLASSES[p] + '">' + p + '</div>';
      });

      document.getElementById('plates-left').innerHTML = leftHtml;
      document.getElementById('plates-right').innerHTML = rightHtml;

      // Report state for test automation
      if (window.__gym95_onPlatesUpdate) {
        window.__gym95_onPlatesUpdate(state, res);
      }
    }

    function changeWeight(delta) {
      state.targetWeight = Math.max(state.barWeight, Math.round((state.targetWeight + delta) * 10) / 10);
      render();
      notifyBot();
    }

    function setBarWeight(bar) {
      state.barWeight = bar;
      if (state.targetWeight < state.barWeight) {
        state.targetWeight = state.barWeight;
      }
      render();
      notifyBot();
    }

    function setPreset(weight) {
      state.targetWeight = Math.max(state.barWeight, weight);
      render();
      notifyBot();
    }

    function notifyBot() {
      if (typeof TelegramWidget !== 'undefined' && TelegramWidget.request) {
        TelegramWidget.request({
          action: 'plates_calc',
          targetWeight: state.targetWeight,
          barWeight: state.barWeight
        });
      }
    }

    if (typeof TelegramWidget !== 'undefined' && TelegramWidget.onEvent) {
      TelegramWidget.onEvent('chatDataChanged', function(newData) {
        try {
          const parsed = typeof newData === 'string' ? JSON.parse(newData) : newData;
          if (parsed && typeof parsed.targetWeight === 'number') {
            state.targetWeight = parsed.targetWeight;
            if (typeof parsed.barWeight === 'number') state.barWeight = parsed.barWeight;
            render();
          }
        } catch(e) {}
      });
    }

    // Expose for testing
    window.__gym95_setPlatesState = function(s) {
      if (s.targetWeight !== undefined) state.targetWeight = s.targetWeight;
      if (s.barWeight !== undefined) state.barWeight = s.barWeight;
      render();
    };

    render();
  </script>
</body>
</html>`;
}
