import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { WorkoutDTO } from '../../shared/types';
import { api, ApiError } from '../api';
import { WorkoutCard } from '../components/WorkoutCard';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { Toast } from '../components/Toast';
import { monthKey, monthLabel } from '../format';
import { confirmDialog, haptic } from '../telegram';
import { WorkoutEditScreen } from './WorkoutEditScreen';

const PAGE_SIZE = 20;

type HistoryFilter = 'all' | 'strength' | 'cardio' | 'pool';

export function HistoryScreen({
  onWorkoutsChanged,
  onEditingChange,
}: {
  onWorkoutsChanged?: () => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [workouts, setWorkouts] = useState<WorkoutDTO[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutDTO | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    onEditingChange?.(editingWorkout !== null);
  }, [editingWorkout, onEditingChange]);

  const loadPage = useCallback(async (offset: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (offset > 0) setLoadingMore(true);
    try {
      const page = await api.history(offset, PAGE_SIZE);
      setWorkouts((prev) => (offset === 0 ? page.workouts : [...prev, ...page.workouts]));
      setHasMore(page.hasMore);
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrorMsg('Открой приложение из Telegram — так проверяется доступ к твоим данным.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Не удалось загрузить историю');
      }
      setStatus('error');
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  useEffect(() => {
    if (!hasMore || status !== 'ready') return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadPage(workouts.length);
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, status, workouts.length, loadPage]);

  const refreshLoadedPage = useCallback(async () => {
    const count = Math.max(workouts.length, PAGE_SIZE);
    const page = await api.history(0, count);
    setWorkouts(page.workouts);
    setHasMore(page.hasMore);
  }, [workouts.length]);

  const handleSaved = async () => {
    setEditingWorkout(null);
    await refreshLoadedPage();
    onWorkoutsChanged?.();
    showToast('Тренировка сохранена ✓');
  };

  const handleDeleted = async () => {
    setEditingWorkout(null);
    await refreshLoadedPage();
    onWorkoutsChanged?.();
    showToast('Тренировка удалена ✓');
  };

  const handleCancelEdit = async () => {
    const confirmed = await confirmDialog('Есть несохранённые изменения тренировки. Уйти без сохранения?');
    if (confirmed) setEditingWorkout(null);
  };

  const filteredWorkouts = useMemo(() => {
    if (filter === 'all') return workouts;
    if (filter === 'strength') return workouts.filter((w) => w.type === 'strength' || w.type === 'mixed');
    if (filter === 'cardio') return workouts.filter((w) => w.type === 'cardio');
    if (filter === 'pool') return workouts.filter((w) => w.type === 'pool');
    return workouts;
  }, [workouts, filter]);

  if (editingWorkout) {
    return (
      <WorkoutEditScreen
        workout={editingWorkout}
        onCancel={handleCancelEdit}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    );
  }

  let content: JSX.Element;
  if (status === 'loading') {
    content = <Loading />;
  } else if (status === 'error') {
    content = <ErrorState title="Ошибка" message={errorMsg} onRetry={() => loadPage(0)} />;
  } else if (workouts.length === 0) {
    content = (
      <EmptyState
        emoji="📭"
        title="Пока нет тренировок"
        message="Добавь первую через бота командой /new_workout — и она появится здесь."
      />
    );
  } else {
    let lastMonth = '';
    content = (
      <div>
        <div className="history-filter-tabs">
          <button
            className={`history-filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              setFilter('all');
            }}
          >
            Все ({workouts.length})
          </button>
          <button
            className={`history-filter-tab ${filter === 'strength' ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              setFilter('strength');
            }}
          >
            🏋️ Силовые
          </button>
          <button
            className={`history-filter-tab ${filter === 'cardio' ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              setFilter('cardio');
            }}
          >
            🏃 Кардио
          </button>
          <button
            className={`history-filter-tab ${filter === 'pool' ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              setFilter('pool');
            }}
          >
            🏊 Бассейн
          </button>
        </div>

        {filteredWorkouts.length === 0 ? (
          <EmptyState
            emoji="🔍"
            title="Нет таких тренировок"
            message="В этой категории пока нет записей. Выбери другой фильтр выше."
          />
        ) : (
          <div>
            {filteredWorkouts.map((w) => {
              const key = monthKey(w.date);
              const showMonth = key !== lastMonth;
              lastMonth = key;
              return (
                <div key={w.id}>
                  {showMonth && <div className="month-label">{monthLabel(w.date)}</div>}
                  <WorkoutCard workout={w} onEdit={setEditingWorkout} />
                </div>
              );
            })}
            {hasMore && filter === 'all' && <div ref={sentinelRef} className="sentinel" />}
            {loadingMore && <div className="loading-more">Загружаю ещё…</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {content}
      {toast && <Toast message={toast} />}
    </>
  );
}
