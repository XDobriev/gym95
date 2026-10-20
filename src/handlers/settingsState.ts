// Состояние ожидания текстового ввода в /settings — отдельно от settings.ts,
// чтобы activeFlow.ts мог проверять его без циклического импорта хендлера.
type AwaitedInput = 'time' | 'goal' | 'body';
const awaiting = new Map<number, AwaitedInput>();

export function isWaitingForTime(userId: number): boolean {
  return awaiting.get(userId) === 'time';
}

export function isWaitingForGoal(userId: number): boolean {
  return awaiting.get(userId) === 'goal';
}

export function isWaitingForBody(userId: number): boolean {
  return awaiting.get(userId) === 'body';
}

export function isAwaitingSettingsInput(userId: number): boolean {
  return awaiting.has(userId);
}

export function setWaitingForTime(userId: number): void {
  awaiting.set(userId, 'time');
}

export function setWaitingForGoal(userId: number): void {
  awaiting.set(userId, 'goal');
}

export function setWaitingForBody(userId: number): void {
  awaiting.set(userId, 'body');
}

export function clearAwaitingSettingsInput(userId: number): void {
  awaiting.delete(userId);
}
