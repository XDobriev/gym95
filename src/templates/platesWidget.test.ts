import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlatesWidgetHtml } from './platesWidget';
import { MAX_WIDGET_HTML_BYTES } from '../utils/telegramWidgets';

test('generatePlatesWidgetHtml: size strictly under 32 KB limit', () => {
  const html = generatePlatesWidgetHtml({
    initialState: { targetWeight: 100, barWeight: 20 },
  });

  const byteLength = Buffer.byteLength(html, 'utf8');
  assert.ok(
    byteLength <= MAX_WIDGET_HTML_BYTES,
    `HTML size must be <= 32 KB, got ${byteLength} bytes`
  );
  assert.ok(byteLength < 16000, `Expected compact HTML, got ${byteLength} bytes`);
});

test('generatePlatesWidgetHtml: adheres to gym95 design tokens', () => {
  const html = generatePlatesWidgetHtml();

  assert.ok(html.includes('--lime: #c9ff2e'), 'Must contain toxic lime token');
  assert.ok(html.includes('Anton'), 'Must import Anton display font for numbers');
  assert.ok(html.includes('Barlow'), 'Must import Barlow font');
  assert.ok(html.includes('plate-25'), 'Must contain Olympic plates CSS');
  assert.ok(!html.includes('linear-gradient') || !html.includes('#00e0a4'), 'Must not mix lime and teal in gradient');
});
