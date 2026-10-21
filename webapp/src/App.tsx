import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import type { SummaryResponse } from '../shared/types';
import { api, ApiError } from './api';
import { getWebApp, haptic, confirmDialog } from './telegram';
import { SummaryBar } from './components/SummaryBar';
import { HistoryScreen } from './screens/HistoryScreen';
import { Loading, ErrorState } from './components/States';

// Экран прогресса тянет за собой Recharts (~400 КБ) — грузим его отдельным
// чанком только при открытии вкладки, чтобы первый экран (История) был лёгким.
const ProgressScreen = lazy(() =>
  import('./screens/ProgressScreen').then((m) => ({ default: m.ProgressScreen }))
);

// «Тело» тоже на Recharts — отдельный чанк.
const BodyScreen = lazy(() => import('./screens/BodyScreen').then((m) => ({ default: m.BodyScreen })));

// Таймер отдыха, секундомер для стадиона и интервалы HIIT/табата.
const TimerScreen = lazy(() => import('./screens/TimerScreen').then((m) => ({ default: m.TimerScreen })));

type Tab = 'history' | 'progress' | 'body' | 'timer';

export function App() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'no-telegram' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab] = useState<Tab>('history');
  const [editingActive, setEditingActive] = useState(false);

  const firstName = getWebApp()?.initDataUnsafe.user?.first_name ?? null;

  const loadSummary = useCallback(async () => {
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    try {
      const s = await api.summary();
      setSummary(s);
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStatus('no-telegram');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Ошибка загрузки');
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Закрытие/сворачивание Telegram во время правки тренировки не должно
  // молча стирать введённое — предупреждаем через нативный диалог браузера/WebView.
  useEffect(() => {
    if (!editingActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editingActive]);

  const switchTab = async (next: Tab) => {
    if (next === tab) return;
    if (editingActive) {
      const confirmed = await confirmDialog('Есть несохранённые изменения тренировки. Уйти без сохранения?');
      if (!confirmed) return;
    }
    haptic('light');
    setTab(next);
  };

  // Правка/удаление тренировки меняет totalWorkouts/streak/объём — перетягиваем
  // сводку сразу, чтобы плашка наверху не показывала устаревшие числа.
  const refreshSummary = useCallback(async () => {
    try {
      setSummary(await api.summary());
    } catch {
      // сводка необязательна для работы экрана — молча оставляем прежнее значение
    }
  }, []);

  if (status === 'loading') {
    return (
      <div className="app">
        <Loading />
      </div>
    );
  }

  if (status === 'no-telegram') {
    return (
      <div className="app">
        <ErrorState
          title="Открой через Telegram"
          message="Это мини-приложение работает внутри Telegram: оно так проверяет, что показывает именно твои тренировки. Нажми кнопку «Дневник» в чате с ботом."
        />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="app">
        <ErrorState title="Что-то пошло не так" message={errorMsg} onRetry={loadSummary} />
      </div>
    );
  }

  return (
    <>
      <div className="app">
        <div className="header">
          <h1>
            gym<span className="accent">95</span>
          </h1>
          <span className="subtitle">{firstName ? `Привет, ${firstName}` : 'Дневник тренировок'}</span>
        </div>

        {summary && tab !== 'body' && tab !== 'timer' && <SummaryBar summary={summary} />}

        {tab === 'history' ? (
          <HistoryScreen onWorkoutsChanged={refreshSummary} onEditingChange={setEditingActive} />
        ) : tab === 'progress' ? (
          <Suspense fallback={<Loading />}>
            <ProgressScreen />
          </Suspense>
        ) : tab === 'body' ? (
          <Suspense fallback={<Loading />}>
            <BodyScreen />
          </Suspense>
        ) : (
          <Suspense fallback={<Loading />}>
            <TimerScreen />
          </Suspense>
        )}
      </div>

      <nav className="tabbar">
        <button className={`tab${tab === 'history' ? ' active' : ''}`} onClick={() => switchTab('history')}>
          <span className="tab-icon">📅</span>
          История
        </button>
        <button className={`tab${tab === 'progress' ? ' active' : ''}`} onClick={() => switchTab('progress')}>
          <span className="tab-icon">📊</span>
          Прогресс
        </button>
        <button className={`tab${tab === 'body' ? ' active' : ''}`} onClick={() => switchTab('body')}>
          <span className="tab-icon">⚖️</span>
          Тело
        </button>
        <button className={`tab${tab === 'timer' ? ' active' : ''}`} onClick={() => switchTab('timer')}>
          <span className="tab-icon">⏱</span>
          Таймер
        </button>
      </nav>
    </>
  );
}
