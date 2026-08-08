// Состояние ожидания текстового ввода в /settings — отдельно от settings.ts,
// чтобы activeFlow.ts мог проверять его без циклического импорта хендлера.
const waitingForTime = new Set<number>();
const waitingForGoal = new Set<number>();

export function isWaitingForTime(userId: number): boolean {
  return waitingForTime.has(userId);
}

export function isWaitingForGoal(userId: number): boolean {
  return waitingForGoal.has(userId);
}

export function isAwaitingSettingsInput(userId: number): boolean {
  return waitingForTime.has(userId) || waitingForGoal.has(userId);
}

export function setWaitingForTime(userId: number): void {
  waitingForGoal.delete(userId);
  waitingForTime.add(userId);
}

export function setWaitingForGoal(userId: number): void {
  waitingForTime.delete(userId);
  waitingForGoal.add(userId);
}

export function clearAwaitingSettingsInput(userId: number): void {
  waitingForTime.delete(userId);
  waitingForGoal.delete(userId);
}
