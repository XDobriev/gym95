import { useEffect, useRef, useState, useCallback } from 'react';
import type { WorkoutDTO } from '../../shared/types';
import { api, ApiError } from '../api';
import { WorkoutCard } from '../components/WorkoutCard';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { monthKey, monthLabel } from '../format';

const PAGE_SIZE = 20;

export function HistoryScreen() {
  const [workouts, setWorkouts] = useState<WorkoutDTO[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

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

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorState title="Ошибка" message={errorMsg} />;
  if (workouts.length === 0) {
    return (
      <EmptyState
        emoji="📭"
        title="Пока нет тренировок"
        message="Добавь первую через бота командой /new_workout — и она появится здесь."
      />
    );
  }

  let lastMonth = '';
  return (
    <div>
      {workouts.map((w) => {
        const key = monthKey(w.date);
        const showMonth = key !== lastMonth;
        lastMonth = key;
        return (
          <div key={w.id}>
            {showMonth && <div className="month-label">{monthLabel(w.date)}</div>}
            <WorkoutCard workout={w} />
          </div>
        );
      })}
      {hasMore && <div ref={sentinelRef} className="sentinel" />}
      {loadingMore && <div className="loading-more">Загружаю ещё…</div>}
    </div>
  );
}
