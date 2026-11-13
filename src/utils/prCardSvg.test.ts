import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePrCardSvg } from './prCardSvg';

test('generatePrCardSvg: генерирует корректный SVG формат 1080x1920 со стилями gym95', () => {
  const svg = generatePrCardSvg({
    exerciseName: 'Жим штанги лёжа',
    weightKg: 100,
    reps: 6,
    estimated1RM: 116.7,
    prevEstimated1RM: 110,
    dateStr: '13 ноября 2026',
    athleteName: 'Иван',
  });

  assert.ok(svg.startsWith('<?xml version="1.0"'));
  assert.ok(svg.includes('viewBox="0 0 1080 1920"'));
  assert.ok(svg.includes('width="1080"'));
  assert.ok(svg.includes('height="1920"'));

  // Проверка цветов по DESIGN.md
  assert.ok(svg.includes('#c9ff2e'), 'должен содержать фирменный токсичный лайм');
  assert.ok(svg.includes('#ff7a1a'), 'должен содержать PR-оранжевый');
  assert.ok(svg.includes('#0e1117'), 'должен содержать темный фон');
  assert.ok(!svg.includes('#00e0a4') && !svg.includes('#00b389'), 'DESIGN.md: никаких смешений лайм+тил на силовых PR карточках');

  // Проверка шрифтов
  assert.ok(svg.includes("font-family: 'Anton'"), 'должен подключать шрифт Anton для чисел');
  assert.ok(svg.includes("font-family: 'Barlow"), 'должен подключать шрифт Barlow для текста');

  // Проверка данных упражнения
  assert.ok(svg.includes('ЖИМ ШТАНГИ ЛЁЖА'));
  assert.ok(svg.includes('100'));
  assert.ok(svg.includes('6'));
  assert.ok(svg.includes('~116.7'));
  assert.ok(svg.includes('+6.7') && svg.includes('КГ'), 'должен рассчитать динамику прироста');
  assert.ok(svg.includes('13 НОЯБРЯ 2026'));
  assert.ok(svg.includes('ИВАН'));
});

test('generatePrCardSvg: без прошлого рекорда генерирует карточку без блока дельты', () => {
  const svg = generatePrCardSvg({
    exerciseName: 'Приседания со штангой',
    weightKg: 140,
    reps: 5,
    estimated1RM: 163.3,
  });

  assert.ok(svg.includes('ПРИСЕДАНИЯ СО ШТАНГОЙ'));
  assert.ok(svg.includes('140'));
  assert.ok(svg.includes('~163.3'));
  assert.ok(!svg.includes('ДИНАМИКА ПРИРОСТА К РЕКОРДУ'));
});
