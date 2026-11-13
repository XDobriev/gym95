import test from 'node:test';
import assert from 'node:assert/strict';
import { saveExerciseSets, addExercise } from './workouts';

test('src/db/workouts: exports addExercise and saveExerciseSets function definitions', () => {
  assert.equal(typeof addExercise, 'function', 'addExercise must be exported from workouts.ts');
  assert.equal(typeof saveExerciseSets, 'function', 'saveExerciseSets must be exported from workouts.ts');
});
