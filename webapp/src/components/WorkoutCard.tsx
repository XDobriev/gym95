import { useState } from 'react';
import type { WorkoutDTO } from '../../shared/types';
import { TYPE_LABEL, TYPE_EMOJI, CARDIO_LABEL, formatSetsInline, formatDateDDMM, pluralizeRu } from '../format';
import { haptic } from '../telegram';

export function WorkoutCard({ workout }: { workout: WorkoutDTO }) {
  const [open, setOpen] = useState(false);
  const hasDetails = workout.exercises.length > 0 || workout.cardio.length > 0 || !!workout.notes;

  const toggle = () => {
    if (!hasDetails) return;
    haptic('light');
    setOpen((v) => !v);
  };

  const exCount = workout.exercises.length;

  return (
    <div className="card" onClick={toggle}>
      <div className="card-top">
        <span className="card-type">
          <span>{TYPE_EMOJI[workout.type]}</span>
          {TYPE_LABEL[workout.type]}
        </span>
        <span className="card-date">{formatDateDDMM(workout.date)}</span>
      </div>

      <div className="card-meta">
        {workout.duration_minutes != null && <span className="chip">🕒 {workout.duration_minutes} мин</span>}
        {workout.warmup_minutes != null && <span className="chip muted">🤸 разминка {workout.warmup_minutes} мин</span>}
        {exCount > 0 && (
          <span className="chip">
            {exCount} {pluralizeRu(exCount, ['упражнение', 'упражнения', 'упражнений'])}
          </span>
        )}
        {workout.cardio.map((c, i) => (
          <span key={i} className="chip muted">
            {CARDIO_LABEL[c.activity]}
            {c.distance_km != null ? ` · ${c.distance_km} км` : ''}
          </span>
        ))}
      </div>

      {open && (
        <div className="exercise-list">
          {workout.exercises.map((ex, i) => (
            <div key={i} className="exercise-row">
              <span className="exercise-name">{ex.name}</span>
              <span className="exercise-sets">{formatSetsInline(ex.sets)}</span>
            </div>
          ))}
          {workout.cardio.map((c, i) => (
            <div key={`c${i}`} className="exercise-row">
              <span className="exercise-name">{CARDIO_LABEL[c.activity]}</span>
              <span className="exercise-sets">
                {[
                  c.distance_km != null ? `${c.distance_km} км` : null,
                  c.avg_pace ? `темп ${c.avg_pace}` : null,
                  c.avg_heart_rate != null ? `❤️ ${c.avg_heart_rate}` : null,
                  c.incline_percent != null ? `уклон ${c.incline_percent}%` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          ))}
          {workout.notes && <div className="notes">«{workout.notes}»</div>}
        </div>
      )}

      {!open && hasDetails && <div className="collapsed-hint">Подробнее ↓</div>}
    </div>
  );
}
