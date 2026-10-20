export type AccessDecision = 'allow' | 'onboard' | 'deny';

export interface AccessInput {
  isOwner: boolean;
  hasProfile: boolean;
  onboardingInProgress: boolean;
  startPayload: string | null;
}

const INVITE_PAYLOAD = /^inv_([a-z0-9]{8})$/;

export function extractInviteCode(payload: string | null): string | null {
  if (!payload) return null;
  const m = INVITE_PAYLOAD.exec(payload);
  return m ? m[1] : null;
}

// Действительность самого кода проверяется при создании профиля (атомарно в БД),
// здесь — только формат.
export function decideAccess(input: AccessInput): AccessDecision {
  if (input.hasProfile) return 'allow';
  if (input.isOwner || input.onboardingInProgress) return 'onboard';
  if (extractInviteCode(input.startPayload)) return 'onboard';
  return 'deny';
}

// Аргумент /start из текста сообщения: «/start inv_x» или «/start@bot inv_x».
export function extractStartPayload(text: string | undefined): string | null {
  if (!text) return null;
  const m = /^\/start(?:@\w+)?\s+(\S+)/.exec(text.trim());
  return m ? m[1] : null;
}
