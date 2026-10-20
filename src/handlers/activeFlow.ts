// Три независимых текстовых FSM (создание тренировки, редактирование тренировки,
// /settings) делят один и тот же bot.on('text') конвейер по userId, но раньше
// ничего не мешало начать один поток, пока активен другой — второй хендлер в
// цепочке молча перехватывал чужой текст (например, ввод времени в /settings
// дописывался как подход в незакрытом /new_workout). Этот модуль — единая точка
// проверки «не занят ли пользователь другим потоком», до входа в новый.
import { getDraft } from './workout/state';
import { getEditSession } from './workout/editState';
import { isAwaitingSettingsInput } from './settingsState';
import { isOnboarding } from './onboarding/state';

export type ActiveFlow = 'draft' | 'edit' | 'settings' | 'onboarding';

const FLOW_MESSAGES: Record<ActiveFlow, string> = {
  draft: '⚠️ У тебя не завершена запись тренировки. Заверши её (/done) или отмени кнопкой в сообщении, прежде чем начать это.',
  edit: '⚠️ У тебя открыто редактирование другой тренировки. Заверши его или нажми «Отмена» в сообщении редактирования, прежде чем начать это.',
  settings: '⚠️ Заверши ввод в /settings (или отправь /settings ещё раз, чтобы сбросить), прежде чем начать это.',
  onboarding: '⚠️ Сначала закончим знакомство — ответь на вопрос выше или отправь /start.',
};

// Возвращает активный поток, отличный от exclude (сам себя поток не блокирует —
// иначе навигация внутри уже открытого редактирования сама себя бы блокировала).
export function otherActiveFlow(userId: number, exclude: ActiveFlow): ActiveFlow | null {
  if (exclude !== 'draft' && getDraft(userId)) return 'draft';
  if (exclude !== 'edit' && getEditSession(userId)) return 'edit';
  if (exclude !== 'settings' && isAwaitingSettingsInput(userId)) return 'settings';
  if (exclude !== 'onboarding' && isOnboarding(userId)) return 'onboarding';
  return null;
}

export function activeFlowBlockedMessage(flow: ActiveFlow): string {
  return FLOW_MESSAGES[flow];
}
