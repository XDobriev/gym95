import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWaterWidgetHtml } from './waterWidget';
import { MAX_WIDGET_HTML_BYTES } from '../utils/telegramWidgets';

test('generateWaterWidgetHtml: size strictly under 32 KB limit', () => {
  const html = generateWaterWidgetHtml({
    initialState: { drunkMl: 1500, targetMl: 2500, workoutBonus: true },
  });

  const byteLength = Buffer.byteLength(html, 'utf8');
  assert.ok(
    byteLength <= MAX_WIDGET_HTML_BYTES,
    `HTML size must be <= 32 KB, got ${byteLength} bytes`
  );
  assert.ok(byteLength < 16000, `Expected compact HTML, got ${byteLength} bytes`);
});

test('generateWaterWidgetHtml: adheres to gym95 design tokens', () => {
  const html = generateWaterWidgetHtml();

  assert.ok(html.includes('--teal: #00e0a4'), 'Must contain teal hydration token');
  assert.ok(html.includes('Anton'), 'Must import Anton font for digits');
  assert.ok(html.includes('Barlow'), 'Must import Barlow font');
  assert.ok(html.includes('btn-tap'), 'Must contain tap buttons');
});
