// Ожидание числового ввода веса/сна: из /weight, /sleep, кнопки «Исправить»
// и шагов утреннего обзора (morning: true — после ввода обзор идёт дальше).
export type BodyInput =
  | { kind: 'weight'; dateStr: string | null; morning: boolean }
  | { kind: 'sleep'; dateStr: string | null; morning: boolean }
  | { kind: 'weightFix'; weightId: string };

const awaiting = new Map<number, BodyInput>();

export function getBodyInput(userId: number): BodyInput | undefined {
  return awaiting.get(userId);
}

export function setBodyInput(userId: number, input: BodyInput): void {
  awaiting.set(userId, input);
}

export function clearBodyInput(userId: number): void {
  awaiting.delete(userId);
}

export function isAwaitingBodyInput(userId: number): boolean {
  return awaiting.has(userId);
}
