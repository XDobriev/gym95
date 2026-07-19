import { useEffect, useState } from 'react';
import type { SummaryResponse } from '../../shared/types';
import { pluralizeRu } from '../format';
import { notifyHaptic } from '../telegram';

// Понедельник текущей календарной недели по локальной дате клиента, YYYY-MM-DD.
// Используется только как ключ дедупликации в localStorage — не обязан
// побитово совпадать с UTC-версией mondayKey на бэкенде.
function weekMondayKey(): string {
  const d = new Date();
  const day = d.getDay(); // 0=вс..6=сб
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function SummaryBar({ summary }: { summary: SummaryResponse }) {
  const streakLabel = pluralizeRu(summary.weekStreak, ['неделя', 'недели', 'недель']);

  // Прогресс к недельной цели по частоте. weekGoal <= 0 (если цель когда-то так
  // настроят) не должен ломать плитку: считаем бар пустым, без состояния «готово».
  const goal = summary.weekGoal;
  const reached = goal > 0 && summary.weekWorkouts >= goal;
  const fillRatio = goal > 0 ? Math.min(summary.weekWorkouts / goal, 1) : 0;

  const [celebrating, setCelebrating] = useState(false);

  // Тренировки создаются только через бота (не в Mini App), поэтому момент
  // «цель только что закрыта» в реальном сценарии почти всегда совпадает с
  // холодной загрузкой Mini App, а не с живым переходом reached=false→true
  // внутри одной сессии компонента. Дедупликация через localStorage по неделе
  // играет роль «было ли это уже показано» вместо сравнения с предыдущим рендером.
  useEffect(() => {
    if (!reached) return;
    const key = `gym95:goal-celebrated:${weekMondayKey()}`;
    try {
      if (localStorage.getItem(key) === '1') return;
      localStorage.setItem(key, '1');
    } catch {
      // localStorage недоступен (приватный режим и т.п.) — деградация:
      // анимация может сыграть больше одного раза за неделю, но не рушим рендер.
    }
    setCelebrating(true);
    notifyHaptic('success');
  }, [reached]);

  return (
    <div className="stat-row">
      <div className="stat-tile hero">
        <div className="stat-value">🔥 {summary.weekStreak}</div>
        <div className="stat-label">{streakLabel} подряд</div>
      </div>
      <div className="stat-tile">
        <div className="stat-value">{summary.totalWorkouts}</div>
        <div className="stat-label">всего тренировок</div>
      </div>
      <div
        className={`stat-tile${reached ? ' reached' : ''}${celebrating ? ' celebrate' : ''}`}
        onAnimationEnd={() => setCelebrating(false)}
      >
        <div className="stat-value">
          {summary.weekWorkouts} / {goal}
          {reached && ' ✓'}
        </div>
        <div className="stat-label">цель недели</div>
        <div className="stat-progress" aria-hidden="true">
          <div className="stat-progress-fill" style={{ transform: `scaleX(${fillRatio})` }} />
        </div>
      </div>
    </div>
  );
}
