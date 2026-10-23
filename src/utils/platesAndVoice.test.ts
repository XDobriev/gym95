import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlates, calculateWarmupSets, formatPlatesShort } from '../../webapp/src/utils/plates';
import { parseVoiceWorkoutSet } from '../../webapp/src/utils/voiceDictation';

describe('calculatePlates', () => {
  it('correctly calculates 100kg with 20kg bar', () => {
    const res = calculatePlates(100, 20);
    assert.equal(res.weightOnBarKg, 80);
    assert.equal(res.weightPerSideKg, 40);
    // 40 кг на сторону: 25 + 15
    assert.deepEqual(res.platesPerSide, [
      { plateKg: 25, countPerSide: 1 },
      { plateKg: 15, countPerSide: 1 },
    ]);
    assert.equal(res.remainderKg, 0);
  });

  it('correctly calculates 82.5kg with 20kg bar', () => {
    const res = calculatePlates(82.5, 20);
    assert.equal(res.weightOnBarKg, 62.5);
    assert.equal(res.weightPerSideKg, 31.25);
    // 31.25 кг: 25 + 5 + 1.25
    assert.deepEqual(res.platesPerSide, [
      { plateKg: 25, countPerSide: 1 },
      { plateKg: 5, countPerSide: 1 },
      { plateKg: 1.25, countPerSide: 1 },
    ]);
    assert.equal(res.remainderKg, 0);
    assert.equal(formatPlatesShort(res), '25 + 5 + 1.25 кг/бок');
  });

  it('handles empty bar', () => {
    const res = calculatePlates(20, 20);
    assert.deepEqual(res.platesPerSide, []);
    assert.equal(formatPlatesShort(res), 'Без блинов');
  });
});

describe('calculateWarmupSets', () => {
  it('generates progressive pyramid for 100kg', () => {
    const warmup = calculateWarmupSets(100, 20);
    assert.ok(warmup.length >= 3);
    assert.equal(warmup[0].weightKg, 20);
    assert.ok(warmup[warmup.length - 1].weightKg < 100);
  });
});

describe('parseVoiceWorkoutSet', () => {
  it('parses "85 на 8"', () => {
    const res = parseVoiceWorkoutSet('85 на 8');
    assert.deepEqual(res, { weight: 85, reps: 8, raw: '85 на 8' });
  });

  it('parses "82 с половиной на 10"', () => {
    const res = parseVoiceWorkoutSet('82 с половиной на 10');
    assert.deepEqual(res, { weight: 82.5, reps: 10, raw: '82 с половиной на 10' });
  });

  it('parses "жим 100 на 6"', () => {
    const res = parseVoiceWorkoutSet('жим 100 на 6');
    assert.deepEqual(res, { weight: 100, reps: 6, raw: 'жим 100 на 6' });
  });

  it('parses "100 8"', () => {
    const res = parseVoiceWorkoutSet('100 8');
    assert.deepEqual(res, { weight: 100, reps: 8, raw: '100 8' });
  });

  it('parses "90 по 8 раз"', () => {
    const res = parseVoiceWorkoutSet('90 по 8 раз');
    assert.deepEqual(res, { weight: 90, reps: 8, raw: '90 по 8 раз' });
  });

  it('parses "60 x 12"', () => {
    const res = parseVoiceWorkoutSet('60 x 12');
    assert.deepEqual(res, { weight: 60, reps: 12, raw: '60 x 12' });
  });

  it('returns null on invalid transcript', () => {
    assert.equal(parseVoiceWorkoutSet('привет как дела'), null);
  });
});
