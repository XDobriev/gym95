import { useRef, useState } from 'react';
import type { WorkoutDTO, WorkoutType, CardioActivity, WorkoutUpdateRequest } from '../../shared/types';
import { api, ApiError } from '../api';
import { TYPE_LABEL, CARDIO_LABEL, toDateInputValue, combineDateInputWithOriginalTime } from '../format';
import { haptic, notifyHaptic, confirmDialog } from '../telegram';

interface EditableExercise {
  id: string;
  name: string;
  setsText: string;
}

interface EditableCardio {
  activity: CardioActivity;
  distanceKm: string;
  avgHeartRate: string;
  inclinePercent: string;
}

const WORKOUT_TYPES: WorkoutType[] = ['strength', 'cardio', 'pool', 'mixed'];
const CARDIO_ACTIVITIES: CardioActivity[] = ['treadmill', 'bike', 'running', 'walking', 'pool'];

function formatSetsForEdit(sets: { weight: number; reps: number }[]): string {
  return sets.map((s) => (s.weight > 0 ? `${s.weight}x${s.reps}` : `${s.reps}`)).join(', ');
}

interface Props {
  workout: WorkoutDTO;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function WorkoutEditScreen({ workout, onCancel, onSaved, onDeleted }: Props) {
  const [date, setDate] = useState(toDateInputValue(workout.date));
  const [type, setType] = useState<WorkoutType>(workout.type);
  const [duration, setDuration] = useState(workout.duration_minutes != null ? String(workout.duration_minutes) : '');
  const [warmup, setWarmup] = useState(workout.warmup_minutes != null ? String(workout.warmup_minutes) : '');
  const [notes, setNotes] = useState(workout.notes ?? '');
  const [exercises, setExercises] = useState<EditableExercise[]>(() =>
    workout.exercises.map((ex, i) => ({ id: `ex-${i}`, name: ex.name, setsText: formatSetsForEdit(ex.sets) }))
  );
  const firstCardio = workout.cardio[0];
  const [cardio, setCardio] = useState<EditableCardio | null>(
    firstCardio
      ? {
          activity: firstCardio.activity,
          distanceKm: firstCardio.distance_km != null ? String(firstCardio.distance_km) : '',
          avgHeartRate: firstCardio.avg_heart_rate != null ? String(firstCardio.avg_heart_rate) : '',
          inclinePercent: firstCardio.incline_percent != null ? String(firstCardio.incline_percent) : '',
        }
      : null
  );

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nextExerciseId = useRef(exercises.length);

  const addExercise = () => {
    haptic('light');
    setExercises((prev) => [...prev, { id: `ex-${nextExerciseId.current++}`, name: '', setsText: '' }]);
  };

  const removeExercise = (id: string) => {
    haptic('light');
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    setExercises((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateExercise = (id: string, patch: Partial<EditableExercise>) => {
    setExercises((prev) => prev.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)));
  };

  function parseOptionalInt(v: string): number | null {
    const trimmed = v.trim();
    return trimmed === '' ? null : parseInt(trimmed, 10);
  }

  function parseOptionalFloat(v: string): number | null {
    const trimmed = v.trim().replace(',', '.');
    return trimmed === '' ? null : parseFloat(trimmed);
  }

  function buildPayload(): { ok: true; value: WorkoutUpdateRequest } | { ok: false; error: string } {
    for (const ex of exercises) {
      const hasName = ex.name.trim() !== '';
      const hasSets = ex.setsText.trim() !== '';
      if (hasName !== hasSets) {
        return { ok: false, error: `Упражнение «${ex.name || ex.setsText}»: заполни и название, и подходы` };
      }
    }
    const filledExercises = exercises.filter((ex) => ex.name.trim() !== '');

    const durationMinutes = parseOptionalInt(duration);
    if (duration.trim() !== '' && (durationMinutes === null || Number.isNaN(durationMinutes) || durationMinutes <= 0)) {
      return { ok: false, error: 'Длительность должна быть целым числом больше нуля' };
    }
    const warmupMinutes = parseOptionalInt(warmup);
    if (warmup.trim() !== '' && (warmupMinutes === null || Number.isNaN(warmupMinutes) || warmupMinutes <= 0)) {
      return { ok: false, error: 'Разминка должна быть целым числом больше нуля' };
    }

    let cardioPayload: WorkoutUpdateRequest['cardio'] = [];
    if (cardio) {
      const distanceKm = parseOptionalFloat(cardio.distanceKm);
      if (cardio.distanceKm.trim() !== '' && (distanceKm === null || Number.isNaN(distanceKm) || distanceKm <= 0)) {
        return { ok: false, error: 'Дистанция должна быть числом больше нуля' };
      }
      const avgHeartRate = parseOptionalInt(cardio.avgHeartRate);
      if (cardio.avgHeartRate.trim() !== '' && (avgHeartRate === null || Number.isNaN(avgHeartRate) || avgHeartRate <= 0)) {
        return { ok: false, error: 'Пульс должен быть целым числом больше нуля' };
      }
      const inclinePercent = parseOptionalFloat(cardio.inclinePercent);
      if (cardio.inclinePercent.trim() !== '' && (inclinePercent === null || Number.isNaN(inclinePercent) || inclinePercent < 0)) {
        return { ok: false, error: 'Уклон должен быть неотрицательным числом' };
      }
      cardioPayload = [{ activity: cardio.activity, distanceKm, avgHeartRate, inclinePercent }];
    }

    return {
      ok: true,
      value: {
        date: combineDateInputWithOriginalTime(date, workout.date),
        type,
        durationMinutes,
        warmupMinutes,
        notes: notes.trim() === '' ? null : notes.trim(),
        exercises: filledExercises.map((ex) => ({ name: ex.name.trim(), setsText: ex.setsText.trim() })),
        cardio: cardioPayload,
      },
    };
  }

  const handleSave = async () => {
    setError('');
    const built = buildPayload();
    if (!built.ok) {
      setError(built.error);
      notifyHaptic('error');
      return;
    }

    setSaving(true);
    try {
      await api.updateWorkout(workout.id, built.value);
      notifyHaptic('success');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить изменения');
      notifyHaptic('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmDialog('Удалить тренировку? Это нельзя отменить.');
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    try {
      await api.deleteWorkout(workout.id);
      notifyHaptic('success');
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить тренировку');
      notifyHaptic('error');
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <div className="edit-screen">
      <div className="edit-header">
        <button className="back-btn" onClick={onCancel} disabled={busy}>
          ← Назад
        </button>
        <h2>Изменить тренировку</h2>
      </div>

      <div className="edit-field">
        <label>Дата</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
      </div>

      <div className="edit-field">
        <label>Тип</label>
        <select value={type} onChange={(e) => setType(e.target.value as WorkoutType)} disabled={busy}>
          {WORKOUT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="edit-row">
        <div className="edit-field">
          <label>Длительность, мин</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="—"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="edit-field">
          <label>Разминка, мин</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="—"
            value={warmup}
            onChange={(e) => setWarmup(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="edit-field">
        <label>Заметки</label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
      </div>

      <div className="edit-section">
        <div className="edit-section-title">Упражнения</div>
        {exercises.map((ex, i) => (
          <div className="edit-exercise-row" key={ex.id}>
            <div className="edit-exercise-inputs">
              <input
                placeholder="Название"
                value={ex.name}
                onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
                disabled={busy}
              />
              <input
                placeholder="40x12, 42.5x10"
                value={ex.setsText}
                onChange={(e) => updateExercise(ex.id, { setsText: e.target.value })}
                disabled={busy}
              />
            </div>
            <div className="edit-exercise-actions">
              <button disabled={busy || i === 0} onClick={() => moveExercise(i, -1)} aria-label="Выше">
                ↑
              </button>
              <button disabled={busy || i === exercises.length - 1} onClick={() => moveExercise(i, 1)} aria-label="Ниже">
                ↓
              </button>
              <button disabled={busy} className="danger" onClick={() => removeExercise(ex.id)} aria-label="Удалить">
                🗑
              </button>
            </div>
          </div>
        ))}
        <button className="add-btn" onClick={addExercise} disabled={busy}>
          + Упражнение
        </button>
      </div>

      <div className="edit-section">
        <div className="edit-section-title">Кардио</div>
        {cardio ? (
          <div className="edit-cardio-block">
            <select
              value={cardio.activity}
              onChange={(e) => setCardio({ ...cardio, activity: e.target.value as CardioActivity })}
              disabled={busy}
            >
              {CARDIO_ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {CARDIO_LABEL[a]}
                </option>
              ))}
            </select>
            <div className="edit-row">
              <input
                placeholder="Дистанция, км"
                inputMode="decimal"
                value={cardio.distanceKm}
                onChange={(e) => setCardio({ ...cardio, distanceKm: e.target.value })}
                disabled={busy}
              />
              <input
                placeholder="Пульс"
                inputMode="numeric"
                value={cardio.avgHeartRate}
                onChange={(e) => setCardio({ ...cardio, avgHeartRate: e.target.value })}
                disabled={busy}
              />
            </div>
            <input
              placeholder="Уклон, %"
              inputMode="decimal"
              value={cardio.inclinePercent}
              onChange={(e) => setCardio({ ...cardio, inclinePercent: e.target.value })}
              disabled={busy}
            />
            <button className="add-btn danger" onClick={() => setCardio(null)} disabled={busy}>
              🗑 Убрать кардио
            </button>
          </div>
        ) : (
          <button
            className="add-btn"
            onClick={() => setCardio({ activity: 'treadmill', distanceKm: '', avgHeartRate: '', inclinePercent: '' })}
            disabled={busy}
          >
            + Кардио
          </button>
        )}
      </div>

      {error && <div className="edit-error">{error}</div>}

      <div className="edit-actions">
        <button className="save-btn" onClick={handleSave} disabled={busy}>
          {saving ? 'Сохраняю…' : '✅ Сохранить'}
        </button>
        <button className="delete-btn" onClick={handleDelete} disabled={busy}>
          {deleting ? 'Удаляю…' : '🗑 Удалить тренировку'}
        </button>
      </div>
    </div>
  );
}
