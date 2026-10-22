import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateBurnedKcal, generateCardioSummary } from './cardioSummary';

test('estimateBurnedKcal: расчет калорий для ходьбы и бега', () => {
  // Ходьба: 60 мин, 5 км (скорость 5 км/ч), 80 кг -> MET ~4.3 * 80 * 1 = 344 ккал
  const walkingKcal = estimateBurnedKcal('walking', 60, 5, 80);
  assert.ok(walkingKcal >= 300 && walkingKcal <= 400);

  // Бег: 30 мин, 5 км (скорость 10 км/ч), 80 кг -> MET ~9.8 * 80 * 0.5 = 392 ккал
  const runningKcal = estimateBurnedKcal('running', 30, 5, 80);
  assert.ok(runningKcal >= 350 && runningKcal <= 450);

  // 0 минут -> 0 ккал
  assert.equal(estimateBurnedKcal('walking', 0, 0, 80), 0);
});

test('generateCardioSummary: расчет кругов и прогресс до ачивок стадиона', () => {
  // 10 кругов на стадионе = 4.0 км за 35 минут
  const summary = generateCardioSummary({
    activity: 'walking',
    durationMinutes: 35,
    distanceKm: 4.0,
    weightKg: 80,
    totalPreviousLaps: 0,
  });

  assert.equal(summary.laps, 10);
  assert.equal(summary.avgPace, '8:45 /км');
  assert.ok(summary.burnedKcal > 150);
  // До 50 кругов (Стадионный бегун) осталось 40 кругов
  assert.equal(summary.nextBadge?.title, '🥈 Стадионный бегун');
  assert.equal(summary.nextBadge?.lapsLeft, 40);

  assert.ok(summary.lines.some((l) => l.includes('10 кругов (4 км) за 35 мин')));
  assert.ok(summary.lines.some((l) => l.includes('Средний темп: 8:45 /км')));
  assert.ok(summary.lines.some((l) => l.includes('Сожжено:')));
  assert.ok(summary.lines.some((l) => l.includes('🥈 Стадионный бегун')));
});

test('generateCardioSummary: первая ачивка 10 кругов', () => {
  // 5 кругов на стадионе = 2.0 км за 20 минут
  const summary = generateCardioSummary({
    activity: 'walking',
    durationMinutes: 20,
    distanceKm: 2.0,
    weightKg: 80,
    totalPreviousLaps: 0,
  });

  assert.equal(summary.laps, 5);
  assert.equal(summary.nextBadge?.title, '🥉 Первые круги');
  assert.equal(summary.nextBadge?.lapsLeft, 5);
  assert.equal(summary.nextBadge?.kmLeft, 2.0);
});
