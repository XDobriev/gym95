import { useCallback, useEffect, useMemo, useState } from 'react';
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

type ProgressTab = 'exercise' | 'volume' | 'stadium';

interface StadiumSession {
  id: string;
  date: string;
  activity: string;
  distanceKm: number;
  durationMinutes: number;
  laps: number;
  avgPace: string | null;
}

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

  const [stadiumSessions, setStadiumSessions] = useState<StadiumSession[] | null>(null);
  const [stadiumStatus, setStadiumStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [stadiumError, setStadiumError] = useState('');

  const loadExercises = useCallback(async () => {
    setStatus('loading');
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
  }, []);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

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

  useEffect(() => {
    if (tab !== 'stadium' || stadiumStatus !== 'idle') return;
    setStadiumStatus('loading');
    (async () => {
      try {
        const res = await api.history(0, 100);
        const sessions: StadiumSession[] = [];
        for (const w of res.workouts) {
          for (const c of w.cardio ?? []) {
            if (c.activity === 'walking' || c.activity === 'running') {
              const distanceKm = c.distance_km ?? 0;
              const laps = Math.round((distanceKm / 0.4) * 10) / 10;
              sessions.push({
                id: `${w.id}_${c.activity}`,
                date: w.date,
                activity: c.activity === 'walking' ? 'Ходьба / Стадион' : 'Бег',
                distanceKm,
                durationMinutes: w.duration_minutes ?? 0,
                laps,
                avgPace: c.avg_pace ?? null,
              });
            }
          }
        }
        setStadiumSessions(sessions);
        setStadiumStatus('ready');
      } catch (err) {
        setStadiumError(err instanceof Error ? err.message : 'Не удалось загрузить данные стадиона');
        setStadiumStatus('error');
      }
    })();
  }, [tab, stadiumStatus]);

  const maxOverall = useMemo(
    () => (points && points.length ? Math.max(...points.map((p) => p.maxWeight)) : 0),
    [points]
  );

  const isCardio = selected.includes('(кардио)');
  const hasDistance = useMemo(
    () => isCardio && (points?.some((p) => (p.distanceKm ?? 0) > 0) ?? false),
    [isCardio, points]
  );
  const isBodyweight = useMemo(
    () => !isCardio && points !== null && points.length > 0 && maxOverall === 0,
    [isCardio, points, maxOverall]
  );

  const maxOverallReps = useMemo(
    () => (points && points.length ? Math.max(...points.map((p) => p.maxReps ?? 0)) : 0),
    [points]
  );

  const chartMetricKey = isCardio
    ? (hasDistance ? 'distanceKm' : 'durationMinutes')
    : (isBodyweight ? 'maxReps' : 'maxWeight');

  const chartTitle = isCardio
    ? (hasDistance ? 'Дистанция, км' : 'Длительность, мин')
    : (isBodyweight ? 'Максимальные повторения, шт' : 'Максимальный вес, кг');

  const tooltipUnit = isCardio
    ? (hasDistance ? 'км' : 'мин')
    : (isBodyweight ? 'повт' : 'кг');

  const switchTab = (next: ProgressTab) => {
    if (next === tab) return;
    haptic('light');
    setTab(next);
  };

  const stadiumStats = useMemo(() => {
    if (!stadiumSessions || stadiumSessions.length === 0) return null;
    const totalLaps = Math.round(stadiumSessions.reduce((acc, s) => acc + s.laps, 0) * 10) / 10;
    const totalKm = Math.round(stadiumSessions.reduce((acc, s) => acc + s.distanceKm, 0) * 10) / 10;
    const totalMinutes = stadiumSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

    const badges = [
      {
        id: 'stadium_10',
        emoji: '🥉',
        title: 'Первые круги',
        target: 10,
        current: Math.min(10, Math.floor(totalLaps)),
        unlocked: totalLaps >= 10,
      },
      {
        id: 'stadium_50',
        emoji: '🥈',
        title: 'Стадионный бегун',
        target: 50,
        current: Math.min(50, Math.floor(totalLaps)),
        unlocked: totalLaps >= 50,
      },
      {
        id: 'stadium_100',
        emoji: '🥇',
        title: 'Хозяин стадиона',
        target: 100,
        current: Math.min(100, Math.floor(totalLaps)),
        unlocked: totalLaps >= 100,
      },
    ];

    const chartPoints = [...stadiumSessions]
      .reverse()
      .map((s) => ({
        label: formatDateDDMM(s.date),
        km: s.distanceKm,
        laps: s.laps,
      }));

    return { totalLaps, totalKm, totalMinutes, badges, chartPoints };
  }, [stadiumSessions]);

  if (status === 'loading') return <Loading />;
  if (status === 'error') {
    return <ErrorState title="Ошибка" message={errorMsg} onRetry={loadExercises} />;
  }
  if (status === 'empty' || !names) {
    return (
      <EmptyState
        emoji="📈"
        title="Пока нечего показать"
        message="Запиши тренировку через бота — и здесь появится график прогресса."
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
          Упражнения
        </button>
        <button
          role="tab"
          aria-selected={tab === 'volume'}
          className={`progress-tab${tab === 'volume' ? ' active' : ''}`}
          onClick={() => switchTab('volume')}
        >
          Тоннаж
        </button>
        <button
          role="tab"
          aria-selected={tab === 'stadium'}
          className={`progress-tab${tab === 'stadium' ? ' active' : ''}`}
          onClick={() => switchTab('stadium')}
        >
          🏟 Стадион
        </button>
      </div>

      {tab === 'exercise' && (
        <>
          <div className="select-wrap">
            <label htmlFor="exercise-select">Упражнение или кардио</label>
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
                <div className="chart-title">{chartTitle}</div>
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
                      formatter={(v: number) => [`${v} ${tooltipUnit}`, 'результат']}
                    />
                    <Line
                      type="monotone"
                      dataKey={chartMetricKey}
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
                {[...points].reverse().map((p, i) => {
                  let valueText = `${p.maxWeight} кг`;
                  let isPr = p.maxWeight === maxOverall && maxOverall > 0;
                  if (isCardio) {
                    valueText = hasDistance ? `${p.distanceKm ?? 0} км` : `${p.durationMinutes ?? 0} мин`;
                    isPr = false;
                  } else if (isBodyweight) {
                    valueText = `${p.maxReps ?? 0} повт`;
                    isPr = (p.maxReps ?? 0) === maxOverallReps && maxOverallReps > 0;
                  }
                  return (
                    <div key={i} className="session-row">
                      <span className="session-date">{formatDateDDMM(p.date)}</span>
                      <span className={`session-max${isPr ? ' pr' : ''}`}>
                        {valueText}{isPr ? ' 🏆' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'volume' && (
        volumeStatus === 'loading' || volumeStatus === 'idle' ? (
          <Loading />
        ) : volumeStatus === 'error' ? (
          <ErrorState title="Ошибка" message={volumeError} onRetry={() => setVolumeStatus('idle')} />
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
        )
      )}

      {tab === 'stadium' && (
        stadiumStatus === 'loading' || stadiumStatus === 'idle' ? (
          <Loading />
        ) : stadiumStatus === 'error' ? (
          <ErrorState title="Ошибка" message={stadiumError} onRetry={() => setStadiumStatus('idle')} />
        ) : !stadiumStats || !stadiumSessions || stadiumSessions.length === 0 ? (
          <EmptyState
            emoji="🏟"
            title="Пока нет записей стадиона"
            message="Запиши ходьбу или бег на стадионе через бота или таймер — и здесь появятся круги и ачивки."
          />
        ) : (
          <div>
            <div className="stadium-stats-grid">
              <div className="stadium-stat-card">
                <div className="stat-label">Всего кругов</div>
                <div className="stat-value">
                  {stadiumStats.totalLaps} <span className="stat-unit">кр</span>
                </div>
                <div className="stat-sub">{stadiumStats.totalKm} км на дорожке</div>
              </div>
              <div className="stadium-stat-card">
                <div className="stat-label">Тренировок</div>
                <div className="stat-value">{stadiumSessions.length}</div>
                <div className="stat-sub">{stadiumStats.totalMinutes} мин активности</div>
              </div>
            </div>

            <div className="stadium-achievements-card">
              <div className="stadium-achievements-title">🏆 Ачивки стадиона</div>
              {stadiumStats.badges.map((b) => (
                <div key={b.id} className="stadium-badge-row">
                  <div className="stadium-badge-icon">{b.emoji}</div>
                  <div className="stadium-badge-info">
                    <div className="stadium-badge-name">
                      <span>{b.title}</span>
                      <span className="stadium-badge-progress-text">
                        {b.unlocked ? '✓ Получено!' : `${b.current} / ${b.target} кр`}
                      </span>
                    </div>
                    <div className="stadium-badge-bar-bg">
                      <div
                        className={`stadium-badge-bar-fill${b.unlocked ? ' unlocked' : ''}`}
                        style={{ width: `${Math.min(100, (b.current / b.target) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="chart-card">
              <div className="chart-title">Динамика дистанции (км)</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stadiumStats.chartPoints} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
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
                    formatter={(v: number) => [`${v} км (~${Math.round((v / 0.4) * 10) / 10} кр)`, 'дистанция']}
                  />
                  <Line
                    type="monotone"
                    dataKey="km"
                    stroke="var(--lime-ink)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--lime-ink)', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'var(--lime-ink)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="session-list">
              {stadiumSessions.map((s) => (
                <div key={s.id} className="session-row">
                  <span className="session-date">{formatDateDDMM(s.date)}</span>
                  <span className="session-max">
                    {s.laps} кр ({s.distanceKm} км){s.durationMinutes > 0 ? ` · ${s.durationMinutes} мин` : ''}
                    {s.avgPace ? ` (${s.avgPace})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
