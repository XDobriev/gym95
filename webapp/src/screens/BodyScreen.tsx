import { useCallback, useEffect, useState } from 'react';
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
  ReferenceLine,
} from 'recharts';
import type { BodyResponse } from '../../shared/types';
import { api } from '../api';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { formatDateDDMM } from '../format';
import { haptic } from '../telegram';

type BodyTab = 'weight' | 'sleep' | 'food' | 'measure';

const MEASURE_LABELS: [string, string][] = [
  ['waist', 'Талия'],
  ['belly', 'Живот'],
  ['chest', 'Грудь'],
  ['hips', 'Бёдра'],
  ['biceps', 'Бицепс'],
  ['thigh', 'Бедро'],
];

const num = (n: number, digits = 1) => n.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const delta = (n: number) => (n > 0 ? `+${num(n)}` : n < 0 ? `−${num(-n)}` : '0');
const hours = (h: number) => {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const tooltipStyle = {
  contentStyle: {
    background: 'var(--tg-bg)',
    border: '1px solid rgba(128,128,128,0.25)',
    borderRadius: 10,
    fontSize: 13,
    color: 'var(--tg-text)',
  },
  labelStyle: { color: 'var(--tg-hint)' },
};
const axisTick = { fontSize: 11, fill: 'var(--tg-hint)' };

export function BodyScreen() {
  const [data, setData] = useState<BodyResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab] = useState<BodyTab>('weight');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setData(await api.body());
      setStatus('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось загрузить данные');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading') return <Loading />;
  if (status === 'error' || !data) return <ErrorState title="Ошибка" message={errorMsg} onRetry={load} />;

  const tabs: [BodyTab, string, boolean][] = [
    ['weight', 'Вес', data.modules.weight],
    ['sleep', 'Сон', data.modules.sleep],
    ['food', 'Еда', data.modules.food],
    ['measure', 'Замеры', data.modules.weight],
  ];
  const visibleTabs = tabs.filter(([, , on]) => on);
  const activeTab = visibleTabs.some(([t]) => t === tab) ? tab : visibleTabs[0]?.[0];

  const switchTab = (next: BodyTab) => {
    if (next === activeTab) return;
    haptic('light');
    setTab(next);
  };

  const lastWeight = data.weights[data.weights.length - 1];

  return (
    <div>
      <div className="stat-row">
        <div className="stat-tile hero">
          <div className="stat-value">{data.weightAvg7 !== null ? num(data.weightAvg7) : lastWeight ? num(lastWeight.kg) : '—'}</div>
          <div className="stat-label">{data.weightAvg7 !== null ? 'вес · 7 дн' : 'вес, кг'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{data.chain ? `${data.chain.current}/${data.chain.goal}` : '—'}</div>
          <div className="stat-label">цепочка</div>
        </div>
        <div className={`stat-tile${data.waterTodayMl >= data.waterTargetMl ? ' reached' : ''}`}>
          <div className="stat-value">{num(data.waterTodayMl / 1000, 2)}</div>
          <div className="stat-label">вода из {num(data.waterTargetMl / 1000, 2)} л</div>
          <div className="stat-progress" aria-hidden="true">
            <div
              className="stat-progress-fill"
              style={{ transform: `scaleX(${Math.min(data.waterTodayMl / Math.max(data.waterTargetMl, 1), 1)})` }}
            />
          </div>
        </div>
      </div>

      {visibleTabs.length === 0 ? (
        <EmptyState emoji="🧩" title="Модули выключены" message="Включи вес, сон или еду в боте: /settings → Модули." />
      ) : (
        <>
          <div className="progress-tabs body-tabs" role="tablist">
            {visibleTabs.map(([t, label]) => (
              <button
                key={t}
                role="tab"
                aria-selected={activeTab === t}
                className={`progress-tab${activeTab === t ? ' active' : ''}`}
                onClick={() => switchTab(t)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'weight' && <WeightPanel data={data} />}
          {activeTab === 'sleep' && <SleepPanel data={data} />}
          {activeTab === 'food' && <FoodPanel data={data} />}
          {activeTab === 'measure' && <MeasurePanel data={data} />}
        </>
      )}
    </div>
  );
}

function WeightPanel({ data }: { data: BodyResponse }) {
  if (data.weights.length === 0) {
    return <EmptyState emoji="⚖️" title="Вес ещё не записан" message="Напиши боту /weight 130.4 — или ответь на утренний вопрос." />;
  }
  const chart = data.weights.map((w) => ({ ...w, label: formatDateDDMM(w.date) }));
  return (
    <>
      <div className="chart-card">
        <div className="chart-title">Вес, кг</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`${num(v)} кг`, 'вес']} />
            <Line type="monotone" dataKey="kg" stroke="var(--lime-ink)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--lime-ink)', strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="session-list">
        {data.weightWeekChange !== null && (
          <div className="session-row">
            <span className="session-date">За неделю (среднее)</span>
            <span className="session-max">{delta(data.weightWeekChange)} кг</span>
          </div>
        )}
        {data.weightMonthChange !== null && (
          <div className="session-row">
            <span className="session-date">За месяц</span>
            <span className="session-max">{delta(data.weightMonthChange)} кг</span>
          </div>
        )}
      </div>
      <p className="body-note">Вес за день скачет на 0,5–1,5 кг из-за воды и соли — смотри на тренд, а не на отдельные точки.</p>
    </>
  );
}

function SleepPanel({ data }: { data: BodyResponse }) {
  if (data.sleep.length === 0) {
    return <EmptyState emoji="😴" title="Сон ещё не записан" message="Ответь на утренний вопрос или напиши боту /sleep 7.5." />;
  }
  const chart = data.sleep.map((s) => ({ ...s, label: formatDateDDMM(s.date) }));
  return (
    <>
      <div className="chart-card">
        <div className="chart-title">Сон, часов{data.sleepAvg7 !== null ? ` · в среднем ${hours(data.sleepAvg7)}` : ''}</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} domain={[0, 'dataMax + 1']} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [hours(v), 'сон']} />
            <ReferenceLine y={7} stroke="var(--tg-hint)" strokeDasharray="4 4" />
            <Bar dataKey="hours" fill="var(--lime-ink)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="body-note">Пунктир — 7 часов, нижняя граница нормы для взрослых.</p>
    </>
  );
}

function FoodPanel({ data }: { data: BodyResponse }) {
  if (data.food.length === 0) {
    return <EmptyState emoji="🍽" title="Еда ещё не записана" message="Пиши боту обычным текстом: «обед 650»." />;
  }
  const chart = data.food.map((f) => ({ ...f, label: formatDateDDMM(f.date) }));
  return (
    <>
      <div className="chart-card">
        <div className="chart-title">Ккал за день{data.foodAvg7 !== null ? ` · в среднем ${num(data.foodAvg7, 0)}` : ''}</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`${num(v, 0)} ккал`, 'еда']} />
            {data.kcalNorm !== null && <ReferenceLine y={data.kcalNorm} stroke="var(--pr)" strokeDasharray="4 4" />}
            <Bar dataKey="kcal" fill="var(--lime-ink)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {data.kcalNorm !== null && (
        <p className="body-note">Пунктир — твоя норма: {num(data.kcalNorm, 0)} ккал (по профилю и последнему весу). В среднем считаются только дни с записями.</p>
      )}
    </>
  );
}

function MeasurePanel({ data }: { data: BodyResponse }) {
  const [last, prev] = data.measurements;
  if (!last) {
    return <EmptyState emoji="📏" title="Замеров пока нет" message="Напиши боту /measure — он спросит 6 замеров по очереди." />;
  }
  return (
    <div className="chart-card">
      <div className="chart-title">
        Замеры {formatDateDDMM(last.date)}
        {prev ? ` · к ${formatDateDDMM(prev.date)}` : ''}
      </div>
      <div className="session-list">
        {MEASURE_LABELS.filter(([key]) => last.values[key] !== null && last.values[key] !== undefined).map(([key, label]) => {
          const v = last.values[key] as number;
          const p = prev?.values[key];
          return (
            <div key={key} className="session-row">
              <span className="session-date">{label}</span>
              <span className="session-max">
                {num(v)} см{p !== null && p !== undefined ? ` (${delta(Math.round((v - p) * 10) / 10)})` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
