import type { SummaryResponse } from '../../shared/types';
import { pluralizeRu, formatVolume } from '../format';

export function SummaryBar({ summary }: { summary: SummaryResponse }) {
  const streakLabel = pluralizeRu(summary.weekStreak, ['неделя', 'недели', 'недель']);
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
      <div className="stat-tile">
        <div className="stat-value">{formatVolume(summary.weekVolumeKg)}</div>
        <div className="stat-label">объём за неделю</div>
      </div>
    </div>
  );
}
