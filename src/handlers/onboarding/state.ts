import { Goal, Sex } from '../../types/profile';

export type OnboardingStep = 'goal' | 'body' | 'sex' | 'tz';

export interface OnboardingSession {
  step: OnboardingStep;
  inviteCode: string | null;
  goal?: Goal;
  heightCm?: number;
  weightKg?: number;
  age?: number;
  sex?: Sex;
  startedAt: number;
}

const sessions = new Map<number, OnboardingSession>();
const STALE_MS = 24 * 60 * 60 * 1000;

export function getOnboarding(userId: number): OnboardingSession | undefined {
  return sessions.get(userId);
}

export function isOnboarding(userId: number): boolean {
  return sessions.has(userId);
}

export function startOnboardingSession(userId: number, inviteCode: string | null): OnboardingSession {
  const s: OnboardingSession = { step: 'goal', inviteCode, startedAt: Date.now() };
  sessions.set(userId, s);
  return s;
}

export function clearOnboarding(userId: number): void {
  sessions.delete(userId);
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, s] of sessions) if (now - s.startedAt > STALE_MS) sessions.delete(userId);
}, 60 * 60 * 1000).unref();
