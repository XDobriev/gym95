import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { ProgressPoint, VolumeHistoryPoint } from '../../shared/types';
import { api, ApiError } from '../api';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { formatDateDDMM, formatVolume } from '../format';
import { haptic } from '../telegram';

type ProgressTab = 'exercise' | 'volume';

export function ProgressScreen() {
  const [names, setNames] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [points, setPoints] = useState<ProgressPoint[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [tab, setTab] = useState<ProgressTab>('exercise');
  const [volumeWeeks, setVolumeWeeks] = useState<VolumeHistoryPoint[] | null>(null);
  const [volumeStatus, setVolumeStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [volumeError, setVolumeError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { names } = await api.exercises();
        if (names.length === 0) {
          setStatus('empty');
          return;
        }
        setNames(names);
        setSelected(names[0]);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setErrorMsg('Открой приложение из Telegram, чтобы увидеть свой прогресс.');
        } else {
          setErrorMsg(err instanceof Error ? err.message : 'Не удалось загрузить упражнения');
        }
        setStatus('error');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setPoints(null);
    (async () => {
      try {
        const res = await api.progress(selected);
        setPoints(res.points);
        setStatus('ready');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Не удалось загрузить прогресс');
        setStatus('error');
      }
    })();
  }, [selected]);

  useEffect(() => {
    if (tab !== 'volume' || volumeStatus !== 'idle') return;
    setVolumeStatus('loading');
    (async () => {
      try {
        const res = await api.volumeHistory();
        setVolumeWeeks(res.weeks);
        setVolumeStatus('ready');
      } catch (err) {
        setVolumeError(err instanceof Error ? err.message : 'Не удалось загрузить тоннаж');
        setVolumeStatus('error');
      }
    })();
  }, [tab, volumeStatus]);

  const maxOverall = useMemo(
    () => (points && points.length ? Math.max(...points.map((p) => p.maxWeight)) : 0),
    [points]
  );

  const switchTab = (next: ProgressTab) => {
    if (next === tab) return;
    haptic('light');
    setTab(next);
  };

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorState title="Ошибка" message={errorMsg} />;
  if (status === 'empty' || !names) {
    return (
      <EmptyState
        emoji="📈"
        title="Пока нечего показать"
        message="Добавь силовую тренировку через бота — и здесь появится график роста весов."
      />
    );
  }

  const chartData = (points ?? []).map((p) => ({ ...p, label: formatDateDDMM(p.date) }));
  const volumeData = (volumeWeeks ?? []).map((w) => ({ ...w, label: formatDateDDMM(w.weekStart) }));

  return (
    <div>
      <div className="progress-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'exercise'}
          className={`progress-tab${tab === 'exercise' ? ' active' : ''}`}
          onClick={() => switchTab('exercise')}
        >
          По упражнению
        </button>
        <button
          role="tab"
          aria-selected={tab === 'volume'}
          className={`progress-tab${tab === 'volume' ? ' active' : ''}`}
          onClick={() => switchTab('volume')}
        >
          Общий тоннаж
        </button>
      </div>

      {tab === 'exercise' ? (
        <>
          <div className="select-wrap">
            <label htmlFor="exercise-select">Упражнение</label>
            <select
              id="exercise-select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {points === null ? (
            <Loading />
          ) : points.length === 0 ? (
            <EmptyState emoji="📭" title="Нет данных" message="По этому упражнению ещё нет записей." />
          ) : (
            <>
              <div className="chart-card">
                <div className="chart-title">Максимальный вес, кг</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
                    <defs>
                      <filter id="gym95-line-glow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--tg-hint)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--tg-hint)' }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      domain={['dataMin - 5', 'dataMax + 5']}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--tg-bg)',
                        border: '1px solid rgba(128,128,128,0.25)',
                        borderRadius: 10,
                        fontSize: 13,
                        color: 'var(--tg-text)',
                      }}
                      labelStyle={{ color: 'var(--tg-hint)' }}
                      formatter={(v: number) => [`${v} кг`, 'макс']}
                    />
                    <Line
                      type="monotone"
                      dataKey="maxWeight"
                      stroke="var(--lime-ink)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--lime-ink)', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: 'var(--lime-ink)' }}
                      filter="url(#gym95-line-glow)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="session-list">
                {[...points].reverse().map((p, i) => (
                  <div key={i} className="session-row">
                    <span className="session-date">{formatDateDDMM(p.date)}</span>
                    <span className={`session-max${p.maxWeight === maxOverall && maxOverall > 0 ? ' pr' : ''}`}>
                      {p.maxWeight} кг{p.maxWeight === maxOverall && maxOverall > 0 ? ' 🏆' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : volumeStatus === 'loading' || volumeStatus === 'idle' ? (
        <Loading />
      ) : volumeStatus === 'error' ? (
        <ErrorState title="Ошибка" message={volumeError} />
      ) : (
        <div className="chart-card">
          <div className="chart-title">Тоннаж по неделям</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volumeData} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--tg-hint)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--tg-hint)' }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--tg-bg)',
                  border: '1px solid rgba(128,128,128,0.25)',
                  borderRadius: 10,
                  fontSize: 13,
                  color: 'var(--tg-text)',
                }}
                labelStyle={{ color: 'var(--tg-hint)' }}
                formatter={(v: number) => [formatVolume(v), 'тоннаж']}
              />
              <Bar dataKey="volumeKg" fill="var(--lime-ink)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
