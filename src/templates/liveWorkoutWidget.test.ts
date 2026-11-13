import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLiveWorkoutWidgetHtml } from './liveWorkoutWidget';
import { MAX_WIDGET_HTML_BYTES } from '../utils/telegramWidgets';

test('generateLiveWorkoutWidgetHtml: bundle size strictly under 32 KB limit', () => {
  const html = generateLiveWorkoutWidgetHtml();
  const bytes = Buffer.byteLength(html, 'utf8');

  assert.ok(bytes > 1000, 'HTML must not be empty');
  assert.ok(bytes < MAX_WIDGET_HTML_BYTES, `HTML (${bytes} bytes) must be < ${MAX_WIDGET_HTML_BYTES} bytes`);
});

test('generateLiveWorkoutWidgetHtml: includes gym95 design tokens and fonts', () => {
  const html = generateLiveWorkoutWidgetHtml({
    title: 'Жим штанги на наклонной скамье',
    initialState: {
      w: 95.0,
      r: 8,
      pw: 92.5,
      pr: 8,
      sn: 2,
      st: 4,
    },
  });

  // Fonts
  assert.ok(html.includes('family=Anton'), 'Must include Anton font');
  assert.ok(html.includes('family=Barlow'), 'Must include Barlow font');

  // Brand colors
  assert.ok(html.includes('#c9ff2e'), 'Must include toxic lime #c9ff2e');
  assert.ok(html.includes('#0a1400'), 'Must include button-ink #0a1400');
  assert.ok(html.includes('#00e0a4'), 'Must include teal #00e0a4');
  assert.ok(html.includes('#131922') || html.includes('#181d24'), 'Must include dark gym background');

  // Exercise and values
  assert.ok(html.includes('Жим штанги на наклонной скамье'), 'Must include exercise title');
  assert.ok(html.includes('95'), 'Must include initial weight');
  assert.ok(html.includes('8'), 'Must include initial reps');

  // Required Interactive IDs
  assert.ok(html.includes('id="btn-w-dec"'), 'Must have weight decrement button');
  assert.ok(html.includes('id="btn-w-inc"'), 'Must have weight increment button');
  assert.ok(html.includes('id="btn-r-dec"'), 'Must have reps decrement button');
  assert.ok(html.includes('id="btn-r-inc"'), 'Must have reps increment button');
  assert.ok(html.includes('id="btn-finish-set"'), 'Must have finish set CTA');
  assert.ok(html.includes('id="btn-skip-rest"'), 'Must have skip rest button');
  assert.ok(html.includes('id="btn-finish-exercise-early"'), 'Must have early finish button in resting mode');
  assert.ok(html.includes('id="btn-add-more-set"'), 'Must have add set button in done mode');
  assert.ok(html.includes('id="ui-rest-countdown"'), 'Must have timer display');
  assert.ok(html.includes('id="ui-done-tonnage"'), 'Must have tonnage display in done mode');

  // Strict DESIGN.md rule: Anton only for numbers, not for exercise titles
  assert.ok(!html.includes(".ex-title {\n      font-family: 'Anton'"), 'Exercise title must not use Anton font');
  // Strict DESIGN.md rule: Don't mix lime and teal on the same element in a gradient
  assert.ok(!html.includes('linear-gradient(135deg, rgba(201, 255, 46'), 'Must not mix lime and teal in single gradient');
});

test('generateLiveWorkoutWidgetHtml: exposes test automation hooks', () => {
  const html = generateLiveWorkoutWidgetHtml();

  assert.ok(html.includes('window.__gym95_getState'), 'Must expose state getter');
  assert.ok(html.includes('window.__gym95_setState'), 'Must expose state setter');
  assert.ok(html.includes('gym95:action'), 'Must dispatch custom DOM event for test harnesses');
});
