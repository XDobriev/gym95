import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccess, extractInviteCode, extractStartPayload } from './accessDecision';

const base = { isOwner: false, hasProfile: false, onboardingInProgress: false, startPayload: null };

test('есть профиль — allow', () => {
  assert.equal(decideAccess({ ...base, hasProfile: true }), 'allow');
  assert.equal(decideAccess({ ...base, hasProfile: true, startPayload: 'inv_abcd1234' }), 'allow');
});

test('владелец без профиля — onboard', () => {
  assert.equal(decideAccess({ ...base, isOwner: true }), 'onboard');
});

test('идёт знакомство — onboard', () => {
  assert.equal(decideAccess({ ...base, onboardingInProgress: true }), 'onboard');
});

test('приглашение правильного формата — onboard', () => {
  assert.equal(decideAccess({ ...base, startPayload: 'inv_abcd1234' }), 'onboard');
});

test('чужой без приглашения или с мусором — deny', () => {
  assert.equal(decideAccess(base), 'deny');
  assert.equal(decideAccess({ ...base, startPayload: 'hello' }), 'deny');
  assert.equal(decideAccess({ ...base, startPayload: 'inv_short' }), 'deny');
});

test('extractInviteCode', () => {
  assert.equal(extractInviteCode('inv_abcd1234'), 'abcd1234');
  assert.equal(extractInviteCode('inv_ABCD1234'), null);
  assert.equal(extractInviteCode(null), null);
});

test('extractStartPayload', () => {
  assert.equal(extractStartPayload('/start inv_abcd1234'), 'inv_abcd1234');
  assert.equal(extractStartPayload('/start@gym95_bot inv_abcd1234'), 'inv_abcd1234');
  assert.equal(extractStartPayload('/start'), null);
  assert.equal(extractStartPayload('привет'), null);
});
