import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBadges, formatBadgesShowcase } from './achievements';

test('evaluateBadges: начальный пользователь', () => {
  const badges = evaluateBadges({
    totalWorkouts: 0,
    totalStadiumLaps: 0,
    totalCardioKm: 0,
    maxWeightLifted: 0,
    maxSingleWorkoutTonnage: 0,
    currentStreakDays: 0,
    bestStreakDays: 0,
    consecutiveWaterDays: 0,
    weightLossKg: 0,
  });

  const unlocked = badges.filter((b) => b.unlocked);
  assert.equal(unlocked.length, 0);
  assert.ok(badges.length >= 10);
});

test('evaluateBadges: опытный атлет (12 тренировок, 12 кругов, 100 кг жим)', () => {
  const badges = evaluateBadges({
    totalWorkouts: 12,
    totalStadiumLaps: 12,
    totalCardioKm: 4.8,
    maxWeightLifted: 100,
    maxSingleWorkoutTonnage: 1200,
    currentStreakDays: 7,
    bestStreakDays: 7,
    consecutiveWaterDays: 7,
    weightLossKg: 3.5,
  });

  const unlocked = badges.filter((b) => b.unlocked);
  // first_workout, workouts_10, heavy_100, tonnage_1000, stadium_10, streak_3, streak_7, water_3, water_7, weight_3
  assert.ok(unlocked.length >= 8);
  const heavy100 = badges.find((b) => b.id === 'heavy_100');
  assert.equal(heavy100?.unlocked, true);
  const stadium10 = badges.find((b) => b.id === 'stadium_10');
  assert.equal(stadium10?.unlocked, true);
});

test('formatBadgesShowcase: форматирует текст', () => {
  const badges = evaluateBadges({
    totalWorkouts: 5,
    totalStadiumLaps: 15,
    totalCardioKm: 6,
    maxWeightLifted: 60,
    maxSingleWorkoutTonnage: 500,
    currentStreakDays: 3,
    bestStreakDays: 3,
    consecutiveWaterDays: 0,
    weightLossKg: 1,
  });

  const text = formatBadgesShowcase(badges);
  assert.ok(text.includes('Витрина достижений'));
  assert.ok(text.includes('Полученные награды'));
  assert.ok(text.includes('В процессе выполнения'));
});

