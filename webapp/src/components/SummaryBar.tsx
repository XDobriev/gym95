import type { SummaryResponse } from '../../shared/types';
import { pluralizeRu } from '../format';

export function SummaryBar({ summary }: { summary: SummaryResponse }) {
  const streakLabel = pluralizeRu(summary.weekStreak, ['неделя', 'недели', 'недель']);

  // Прогресс к недельной цели по частоте. weekGoal <= 0 (если цель когда-то так
  // настроят) не должен ломать плитку: считаем бар пустым, без состояния «готово».
  const goal = summary.weekGoal;
  const reached = goal > 0 && summary.weekWorkouts >= goal;
  const fillRatio = goal > 0 ? Math.min(summary.weekWorkouts / goal, 1) : 0;

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
      <div className={`stat-tile${reached ? ' reached' : ''}`}>
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
