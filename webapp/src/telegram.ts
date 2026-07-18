// Минимальная типизация Telegram WebApp SDK (window.Telegram.WebApp),
// который грузится скриптом telegram-web-app.js в index.html.

export interface TelegramThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  header_bg_color?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; first_name?: string; last_name?: string; username?: string };
  };
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  onEvent: (event: string, handler: () => void) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    selectionChanged: () => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  showConfirm?: (message: string, callback: (confirmed: boolean) => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

// Прокидываем цвета темы Telegram в CSS-переменные, чтобы приложение
// выглядело родно в светлой и тёмной теме пользователя.
export function applyTheme(webApp: TelegramWebApp): void {
  const root = document.documentElement;
  const p = webApp.themeParams;
  const set = (name: string, value: string | undefined, fallback: string) => {
    root.style.setProperty(name, value || fallback);
  };
  const dark = webApp.colorScheme === 'dark';
  set('--tg-bg', p.bg_color, dark ? '#17212b' : '#ffffff');
  set('--tg-secondary-bg', p.secondary_bg_color, dark ? '#232e3c' : '#f0f2f5');
  set('--tg-text', p.text_color, dark ? '#f5f5f5' : '#111111');
  set('--tg-hint', p.hint_color, dark ? '#7d8b99' : '#8a8f98');
  set('--tg-link', p.link_color, dark ? '#6ab7ff' : '#2481cc');
  root.dataset.scheme = webApp.colorScheme;
}

let cachedHaptic: TelegramWebApp['HapticFeedback'] | undefined;
export function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  cachedHaptic ??= getWebApp()?.HapticFeedback;
  cachedHaptic?.impactOccurred(style);
}

export function notifyHaptic(type: 'error' | 'success' | 'warning'): void {
  cachedHaptic ??= getWebApp()?.HapticFeedback;
  cachedHaptic?.notificationOccurred(type);
}

// Нативный confirm Telegram, если доступен (webApp.showConfirm) — иначе браузерный.
// В деве (вне Telegram) window.confirm тоже работает, так что удаление тестируемо.
export function confirmDialog(message: string): Promise<boolean> {
  const webApp = getWebApp();
  if (webApp?.showConfirm) {
    return new Promise((resolve) => webApp.showConfirm!(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}
