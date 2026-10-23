import { useEffect, useState, useRef, useMemo } from 'react';
import type { LiveContextResponse, SaveLiveWorkoutResponse } from '../../shared/types';
import { api } from '../api';
import { haptic, notifyHaptic, confirmDialog } from '../telegram';
import { playBeep, playFinishedBeep, unlockAudio } from '../sound';
import {
  ActiveWorkoutDraft,
  DraftExercise,
  calculateSessionVolume,
  getGhostValues,
  calculateExerciseTarget,
  loadWorkoutDraft,
  saveWorkoutDraft,
  clearWorkoutDraft,
} from '../utils/liveWorkout';
import { calculatePlates, calculateWarmupSets, BAR_WEIGHT_OPTIONS } from '../utils/plates';
import { createSpeechRecognizer, isSpeechRecognitionSupported, parseVoiceWorkoutSet } from '../utils/voiceDictation';
import {
  generateWorkoutShareCard,
  shareOrDownloadWorkoutCard,
  formatWorkoutSummaryText,
  ShareCardData,
} from '../utils/shareCard';

interface LiveWorkoutScreenProps {
  onWorkoutsChanged?: () => void;
  onGoToHistory?: () => void;
}

const MUSCLE_GROUPS = ['Все', 'Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс'] as const;

const MUSCLE_KEYWORDS: Record<string, string[]> = {
  'Грудь': ['жим', 'брусья', 'разводка', 'отжимания', 'пек', 'кроссовер'],
  'Спина': ['тяга', 'подтягивания', 'гиперэкстензия', 'блок', 'шраги'],
  'Ноги': ['присед', 'жим ногами', 'выпады', 'разгибания', 'сгибания', 'икры', 'румынская', 'гакк'],
  'Плечи': ['жим стоя', 'армейский', 'махи', 'подъём перед собой', 'дельта'],
  'Руки': ['бицепс', 'трицепс', 'молот', 'французский', 'скотт'],
  'Пресс': ['скручивания', 'планка', 'подъём ног', 'пресс'],
};

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function LiveWorkoutScreen({ onWorkoutsChanged, onGoToHistory }: LiveWorkoutScreenProps) {
  const [context, setContext] = useState<LiveContextResponse | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [draft, setDraft] = useState<ActiveWorkoutDraft | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Плавающий таймер отдыха
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);

  // Шторка выбора упражнений
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Все');

  // Модалка завершения
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [finishResult, setFinishResult] = useState<SaveLiveWorkoutResponse | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Вектор 1: Калькулятор блинов
  const [activePlateCalc, setActivePlateCalc] = useState<{
    exerciseName: string;
    exerciseId: string;
    currentWeight: number;
    barWeight: number;
  } | null>(null);

  // Вектор 1: RIR селектор
  const [rirPickerTarget, setRirPickerTarget] = useState<{
    exerciseId: string;
    setId: string;
    currentRir: number | null;
  } | null>(null);

  // Вектор 2: Голосовой ввод
  const [isListeningExerciseId, setIsListeningExerciseId] = useState<string | null>(null);
  const recognizerRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  // Вектор 3: Stories Share Card
  const [generatingShareCard, setGeneratingShareCard] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Инициализация: загружаем контекст и проверяем драфт в localStorage
  useEffect(() => {
    let mounted = true;
    api
      .liveContext()
      .then((data) => {
        if (mounted) {
          setContext(data);
          setLoadingContext(false);
        }
      })
      .catch((err) => {
        console.warn('Не удалось загрузить liveContext', err);
        if (mounted) setLoadingContext(false);
      });

    const savedDraft = loadWorkoutDraft();
    if (savedDraft) {
      setDraft(savedDraft);
      const elapsed = Math.max(0, Math.floor((Date.now() - savedDraft.startTime) / 1000));
      setElapsedSeconds(elapsed);
    }

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Таймер тренировки
  useEffect(() => {
    if (!draft) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      const nowSec = Math.max(0, Math.floor((Date.now() - draft.startTime) / 1000));
      setElapsedSeconds(nowSec);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [draft?.startTime]);

  // 3. Плавающий таймер отдыха
  useEffect(() => {
    if (restSecondsLeft === null || restSecondsLeft <= 0) return;

    const interval = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          playFinishedBeep();
          notifyHaptic('success');
          return null;
        }
        if (prev === 4 || prev === 3 || prev === 2) {
          playBeep(700, 0.1);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [restSecondsLeft]);

  // 4. Синхронизация драфта с localStorage при любых изменениях
  const updateDraft = (newDraft: ActiveWorkoutDraft | null) => {
    setDraft(newDraft);
    if (newDraft) {
      saveWorkoutDraft(newDraft);
    } else {
      clearWorkoutDraft();
      setRestSecondsLeft(null);
    }
  };

  // --- СТАРТ ТРЕНИРОВКИ ---

  const startBlankWorkout = () => {
    unlockAudio();
    haptic('medium');
    const newDraft: ActiveWorkoutDraft = {
      startTime: Date.now(),
      exercises: [],
    };
    updateDraft(newDraft);
    setShowAddModal(true); // сразу открываем каталог упражнений
  };

  const startRepeatLast = () => {
    if (!context?.lastWorkout) return;
    unlockAudio();
    haptic('medium');

    const exercises: DraftExercise[] = context.lastWorkout.exercises.map((ex, exIdx) => ({
      id: `ex_${Date.now()}_${exIdx}`,
      name: ex.name,
      sets: ex.sets.map((_, sIdx) => ({
        id: `set_${Date.now()}_${exIdx}_${sIdx}`,
        weight: '',
        reps: '',
        completed: false,
      })),
    }));

    const newDraft: ActiveWorkoutDraft = {
      startTime: Date.now(),
      exercises,
    };
    updateDraft(newDraft);
  };

  const startFromTemplate = (templateId: string, name: string) => {
    const tpl = context?.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    unlockAudio();
    haptic('medium');

    const exercises: DraftExercise[] = tpl.exercises.map((ex, exIdx) => ({
      id: `ex_${Date.now()}_${exIdx}`,
      name: ex.name,
      sets: Array.from({ length: ex.defaultSetsCount || 3 }).map((_, sIdx) => ({
        id: `set_${Date.now()}_${exIdx}_${sIdx}`,
        weight: '',
        reps: '',
        completed: false,
      })),
    }));

    const newDraft: ActiveWorkoutDraft = {
      startTime: Date.now(),
      templateId,
      templateName: name,
      exercises,
    };
    updateDraft(newDraft);
  };

  const cancelWorkout = async () => {
    const confirmed = await confirmDialog('Отменить текущую тренировку? Все несохранённые подходы будут удалены.');
    if (!confirmed) return;
    haptic('medium');
    updateDraft(null);
  };

  // --- УПРАВЛЕНИЕ УПРАЖНЕНИЯМИ И СЕТАМИ ---

  const addExerciseToDraft = (name: string) => {
    if (!draft) return;
    unlockAudio();
    haptic('light');

    const newExercise: DraftExercise = {
      id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      sets: [
        {
          id: `set_${Date.now()}_0`,
          weight: '',
          reps: '',
          completed: false,
        },
      ],
    };

    updateDraft({
      ...draft,
      exercises: [...draft.exercises, newExercise],
    });
    setShowAddModal(false);
    setSearchQuery('');
  };

  const removeExerciseFromDraft = async (exerciseId: string) => {
    if (!draft) return;
    const confirmed = await confirmDialog('Удалить это упражнение из тренировки?');
    if (!confirmed) return;
    haptic('light');

    updateDraft({
      ...draft,
      exercises: draft.exercises.filter((e) => e.id !== exerciseId),
    });
  };

  const addSetToExercise = (exerciseId: string) => {
    if (!draft) return;
    haptic('light');

    const ex = draft.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const nextIndex = ex.sets.length;

    const newSet = {
      id: `set_${Date.now()}_${nextIndex}`,
      weight: '' as const,
      reps: '' as const,
      completed: false,
    };

    updateDraft({
      ...draft,
      exercises: draft.exercises.map((e) => (e.id === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e)),
    });
  };

  const removeSetFromExercise = (exerciseId: string, setId: string) => {
    if (!draft) return;
    haptic('light');

    updateDraft({
      ...draft,
      exercises: draft.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.filter((s) => s.id !== setId),
        };
      }),
    });
  };

  const updateSetValue = (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps',
    value: string
  ) => {
    if (!draft) return;
    const num = value === '' ? '' : parseFloat(value);
    const safeVal = typeof num === 'number' && isNaN(num) ? '' : num;

    updateDraft({
      ...draft,
      exercises: draft.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: safeVal } : s)),
        };
      }),
    });
  };

  const toggleSetComplete = (exerciseId: string, setId: string, setIndex: number) => {
    if (!draft) return;
    unlockAudio();

    const ex = draft.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const currentSet = ex.sets.find((s) => s.id === setId);
    if (!currentSet) return;

    const willComplete = !currentSet.completed;

    // Ghost values автоподстановка, если значения не были введены вручную
    const ghost = getGhostValues(context?.lastWorkout, ex.name, setIndex);
    const finalWeight = currentSet.weight === '' ? ghost.weight : currentSet.weight;
    const finalReps = currentSet.reps === '' ? ghost.reps : currentSet.reps;

    if (willComplete) {
      notifyHaptic('success');
    } else {
      haptic('light');
    }

    updateDraft({
      ...draft,
      exercises: draft.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.map((s) =>
            s.id === setId
              ? {
                  ...s,
                  weight: finalWeight,
                  reps: finalReps,
                  completed: willComplete,
                }
              : s
          ),
        };
      }),
    });

    // При выполнении подхода автоматически стартуем таймер отдыха на 90 секунд
    if (willComplete) {
      setRestSecondsLeft(90);
    }
  };

  // --- ФИНИШ И СОХРАНЕНИЕ ---

  const currentVolume = useMemo(() => {
    if (!draft) return 0;
    return calculateSessionVolume(draft.exercises);
  }, [draft]);

  const handleFinishClick = () => {
    if (!draft) return;
    haptic('medium');
    setTemplateName(draft.templateName || `Тренировка ${new Date().toLocaleDateString('ru-RU')}`);
    setShowFinishModal(true);
  };

  const handleSaveWorkout = async () => {
    if (!draft) return;
    setSavingWorkout(true);
    haptic('medium');

    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    const exercisesPayload = draft.exercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets.map((s) => ({
        weight: typeof s.weight === 'number' ? s.weight : 0,
        reps: typeof s.reps === 'number' ? s.reps : 0,
        completed: s.completed,
      })),
    }));

    try {
      const response = await api.saveLiveWorkout({
        durationMinutes,
        templateId: draft.templateId,
        saveAsTemplateName: saveAsTemplate && templateName.trim() ? templateName.trim() : undefined,
        exercises: exercisesPayload,
      });

      setFinishResult(response);
      playFinishedBeep();
      notifyHaptic('success');
      clearWorkoutDraft();
      if (onWorkoutsChanged) onWorkoutsChanged();
    } catch (err) {
      notifyHaptic('error');
      alert(err instanceof Error ? err.message : 'Ошибка сохранения тренировки');
    } finally {
      setSavingWorkout(false);
    }
  };

  // Вектор 2: Применить цель на сегодня к незаполненным подходам
  const applyTargetToExercise = (exerciseId: string, weight: number, reps: number) => {
    if (!draft) return;
    haptic('medium');
    updateDraft({
      ...draft,
      exercises: draft.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.map((s) => (s.completed ? s : { ...s, weight, reps })),
        };
      }),
    });
  };

  // Вектор 1: Открытие калькулятора блинов
  const handleOpenPlateCalc = (exercise: DraftExercise) => {
    haptic('light');
    const firstSetWeight =
      typeof exercise.sets[0]?.weight === 'number' && exercise.sets[0].weight > 0
        ? exercise.sets[0].weight
        : 60;
    setActivePlateCalc({
      exerciseName: exercise.name,
      exerciseId: exercise.id,
      currentWeight: firstSetWeight,
      barWeight: 20,
    });
  };

  // Вектор 1: RIR селектор
  const handleOpenRirPicker = (exerciseId: string, setId: string, currentRir?: number | null) => {
    haptic('light');
    setRirPickerTarget({ exerciseId, setId, currentRir: currentRir ?? null });
  };

  const handleSelectRir = (rir: number | null) => {
    if (!draft || !rirPickerTarget) return;
    haptic('light');
    const { exerciseId, setId } = rirPickerTarget;

    updateDraft({
      ...draft,
      exercises: draft.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.map((s) => (s.id === setId ? { ...s, rir } : s)),
        };
      }),
    });
    setRirPickerTarget(null);
  };

  // Вектор 2: Голосовой ввод подхода
  const handleToggleVoice = (exerciseId: string) => {
    if (isListeningExerciseId === exerciseId) {
      recognizerRef.current?.stop();
      setIsListeningExerciseId(null);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      const text = prompt('Быстрый ввод подхода (например: "85 на 8" или "100 6"):');
      if (text) {
        const parsed = parseVoiceWorkoutSet(text);
        if (parsed) {
          applyParsedVoiceSet(exerciseId, parsed.weight, parsed.reps);
        } else {
          alert('Не удалось распознать вес и повторения. Попробуйте формат: 85 на 8');
        }
      }
      return;
    }

    unlockAudio();
    haptic('medium');
    setIsListeningExerciseId(exerciseId);

    const recognizer = createSpeechRecognizer(
      (_raw, parsed) => {
        if (parsed) {
          applyParsedVoiceSet(exerciseId, parsed.weight, parsed.reps);
        }
        setIsListeningExerciseId(null);
      },
      (err) => {
        console.warn('Voice recognition error:', err);
        setIsListeningExerciseId(null);
      },
      () => {
        setIsListeningExerciseId(null);
      }
    );

    recognizerRef.current = recognizer;
    recognizer?.start();
  };

  const applyParsedVoiceSet = (exerciseId: string, weight: number, reps: number) => {
    if (!draft) return;
    notifyHaptic('success');

    updateDraft({
      ...draft,
      exercises: draft.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        const targetSet = e.sets.find((s) => !s.completed) || e.sets[e.sets.length - 1];
        if (!targetSet) return e;

        return {
          ...e,
          sets: e.sets.map((s) =>
            s.id === targetSet.id ? { ...s, weight, reps, completed: true } : s
          ),
        };
      }),
    });

    setRestSecondsLeft(90);
  };

  // Вектор 3: Генерация и шаринг Stories Card
  const getShareCardData = (): ShareCardData => {
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const exercisesData = (draft?.exercises || []).map((ex) => {
      let bestSet = { weight: 0, reps: 0 };
      let completedSetsCount = 0;
      for (const s of ex.sets) {
        if (s.completed && typeof s.weight === 'number' && typeof s.reps === 'number') {
          completedSetsCount++;
          if (s.weight > bestSet.weight) {
            bestSet = { weight: s.weight, reps: s.reps };
          }
        }
      }
      return {
        name: ex.name,
        bestSet,
        totalSets: completedSetsCount || ex.sets.length,
      };
    });

    const sharePrs = (finishResult?.newPrs || []).map((pr) => ({
      exercise: pr.exercise,
      weight: pr.weight,
      reps: pr.reps,
      oneRepMax: pr.oneRepMax,
    }));

    return {
      dateStr: new Date().toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      durationMinutes,
      totalVolumeKg: currentVolume,
      totalSets: exercisesData.reduce((acc, e) => acc + e.totalSets, 0),
      exercises: exercisesData,
      newPrs: sharePrs,
    };
  };

  const handleShareStory = async () => {
    try {
      setGeneratingShareCard(true);
      haptic('medium');
      const shareData = getShareCardData();
      const blob = await generateWorkoutShareCard(shareData);
      await shareOrDownloadWorkoutCard(blob, `gym95-workout-${Date.now()}.png`);
      notifyHaptic('success');
    } catch (err) {
      console.error('Ошибка создания Stories карточки:', err);
      notifyHaptic('error');
    } finally {
      setGeneratingShareCard(false);
    }
  };

  const handleCopySummary = async () => {
    try {
      haptic('light');
      const shareData = getShareCardData();
      const text = formatWorkoutSummaryText(shareData);
      await navigator.clipboard.writeText(text);
      notifyHaptic('success');
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch (err) {
      console.warn('Не удалось скопировать текст в буфер:', err);
    }
  };

  // Каталог упражнений с поиском и фильтром по мышцам
  const filteredCatalog = useMemo(() => {
    let list = context?.commonExercises || [];
    if (selectedMuscle !== 'Все') {
      const keywords = MUSCLE_KEYWORDS[selectedMuscle] || [];
      list = list.filter((item) => {
        const lower = item.toLowerCase();
        return keywords.some((kw) => lower.includes(kw));
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((item) => item.toLowerCase().includes(q));
    }
    return list;
  }, [context?.commonExercises, searchQuery, selectedMuscle]);

  // ===================== РЕНДЕР =====================

  // ЭКРАН 1: WORKOUT HUB (нет активной тренировки)
  if (!draft) {
    return (
      <div className="workout-hub">
        <div className="hub-hero">
          <div className="hub-badge">⚡ Live Workout</div>
          <h2>Тренировка в зале</h2>
          <p className="subtitle">Отмечай подходы в один тап прямо у тренажёра</p>
        </div>

        {/* Быстрый старт: Повторить последнюю */}
        {context?.lastWorkout && (
          <div className="card hub-card repeat-card" onClick={startRepeatLast}>
            <div className="repeat-card-badge">Рекомендуется</div>
            <div className="repeat-card-header">
              <h3>⚡ Повторить последнюю</h3>
              <span className="repeat-date">
                {new Date(context.lastWorkout.date).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
            <div className="repeat-card-details">
              <span>{context.lastWorkout.exercises.length} упр.</span>
              <span>•</span>
              <span className="repeat-names">
                {context.lastWorkout.exercises.map((e) => e.name).slice(0, 3).join(', ')}
                {context.lastWorkout.exercises.length > 3 ? '...' : ''}
              </span>
            </div>
            <button className="btn-hub-action">Повторить в 1 тап ➔</button>
          </div>
        )}

        {/* Чистая тренировка */}
        <div className="card hub-card blank-card" onClick={startBlankWorkout}>
          <div className="blank-card-content">
            <div className="blank-icon">➕</div>
            <div>
              <h3>Свободная тренировка</h3>
              <p>Начать с чистого листа и добавлять упражнения на ходу</p>
            </div>
          </div>
        </div>

        {/* Шаблоны */}
        {context && context.templates.length > 0 && (
          <div className="hub-templates-section">
            <h3 className="section-title">📋 Программы и шаблоны</h3>
            <div className="templates-grid">
              {context.templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="card template-item-card"
                  onClick={() => startFromTemplate(tpl.id, tpl.name)}
                >
                  <div className="template-title">{tpl.name}</div>
                  <div className="template-sub">{tpl.exercises.length} упр.</div>
                  <button className="btn-template-start">Старт</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingContext && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#8a8f98' }}>
            Загрузка программ...
          </div>
        )}
      </div>
    );
  }

  // ЭКРАН 2: LIVE SESSION (активная тренировка)
  return (
    <div className="live-session">
      {/* Sticky Top Header */}
      <div className="live-header">
        <div className="live-timer-block">
          <span className="live-label">В процессе</span>
          <div className="live-timer-digits">{formatDuration(elapsedSeconds)}</div>
        </div>

        <div className="live-volume-block">
          <span className="live-label">Тоннаж</span>
          <div className="live-volume-digits">{currentVolume.toLocaleString('ru-RU')} кг</div>
        </div>

        <div className="live-actions-block">
          <button className="btn-finish-workout" onClick={handleFinishClick}>
            Финиш 🏁
          </button>
          <button className="btn-cancel-workout" onClick={cancelWorkout} title="Отменить тренировку">
            ✕
          </button>
        </div>
      </div>

      {/* Список упражнений */}
      <div className="live-exercises-list">
        {draft.exercises.length === 0 ? (
          <div className="live-empty-state">
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏋️</div>
            <h3>Упражнения ещё не добавлены</h3>
            <p>Нажми кнопку ниже, чтобы выбрать упражнение из базы</p>
            <button className="btn-add-exercise-hero" onClick={() => setShowAddModal(true)}>
              + Добавить упражнение
            </button>
          </div>
        ) : (
          draft.exercises.map((exercise, exIndex) => {
            return (
              <div key={exercise.id} className="card live-exercise-card">
                <div className="exercise-card-header">
                  <div className="exercise-title-group">
                    <span className="exercise-num">{exIndex + 1}</span>
                    <h3 className="exercise-name">{exercise.name}</h3>
                  </div>
                  <div className="exercise-header-actions">
                    <button
                      type="button"
                      className="btn-action-icon"
                      onClick={() => handleOpenPlateCalc(exercise)}
                      title="Калькулятор блинов"
                      aria-label={`Калькулятор блинов для упражнения ${exercise.name}`}
                    >
                      🥞
                    </button>
                    <button
                      type="button"
                      className={`btn-action-icon btn-voice-input ${
                        isListeningExerciseId === exercise.id ? 'listening' : ''
                      }`}
                      onClick={() => handleToggleVoice(exercise.id)}
                      title={
                        isListeningExerciseId === exercise.id
                          ? 'Идёт запись... Скажите: 85 на 8'
                          : 'Голосовой ввод подхода (напр. "85 на 8")'
                      }
                      aria-label={`Голосовой ввод подхода для упражнения ${exercise.name}`}
                    >
                      🎙️
                    </button>
                    <button
                      type="button"
                      className="btn-action-icon"
                      onClick={() => removeExerciseFromDraft(exercise.id)}
                      title="Удалить упражнение"
                      aria-label={`Удалить упражнение ${exercise.name}`}
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {/* Вектор 2: AI Прогрессия / Цель на сегодня */}
                {(() => {
                  const target = calculateExerciseTarget(context?.lastWorkout, exercise.name);
                  if (!target) return null;
                  return (
                    <div className="ai-target-banner">
                      <div className="ai-target-info">
                        <span className="ai-target-title">🎯 Цель на сегодня</span>
                        <div className="ai-target-text">
                          {target.targetWeight} кг × {target.targetReps} повт.{' '}
                          <span className="ai-target-subtext">(1RM ~{target.estimated1RM} кг)</span>
                        </div>
                        <div className="ai-target-subtext">{target.reason}</div>
                      </div>
                      <button
                        type="button"
                        className="btn-apply-target"
                        onClick={() =>
                          applyTargetToExercise(exercise.id, target.targetWeight, target.targetReps)
                        }
                        title="Подставить цель в незавершенные подходы"
                        aria-label={`Применить цель ${target.targetWeight} кг на ${target.targetReps} повторений`}
                      >
                        Вставить ➔
                      </button>
                    </div>
                  );
                })()}

                {/* Таблица сетов */}
                <div className="sets-table">
                  <div className="sets-header-row">
                    <div className="set-col-num">Сет</div>
                    <div className="set-col-prev">Прошлый</div>
                    <div className="set-col-kg">Кг</div>
                    <div className="set-col-reps">Повт</div>
                    <div className="set-col-rir" title="Запас повторений в подходе">RIR</div>
                    <div className="set-col-check">✓</div>
                  </div>

                  {exercise.sets.map((set, setIndex) => {
                    const ghost = getGhostValues(context?.lastWorkout, exercise.name, setIndex);
                    return (
                      <div
                        key={set.id}
                        className={`set-row ${set.completed ? 'set-row-completed' : ''}`}
                      >
                        <div className="set-col-num">{setIndex + 1}</div>
                        <div className="set-col-prev">
                          {ghost.weight > 0 ? `${ghost.weight}×${ghost.reps}` : `—`}
                        </div>
                        <div className="set-col-kg">
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            className="set-input"
                            placeholder={ghost.weight > 0 ? String(ghost.weight) : '0'}
                            value={set.weight}
                            aria-label={`Вес в кг для подхода ${setIndex + 1} упражнения ${exercise.name}`}
                            onChange={(e) =>
                              updateSetValue(exercise.id, set.id, 'weight', e.target.value)
                            }
                          />
                        </div>
                        <div className="set-col-reps">
                          <input
                            type="number"
                            inputMode="numeric"
                            className="set-input"
                            placeholder={String(ghost.reps)}
                            value={set.reps}
                            aria-label={`Повторения для подхода ${setIndex + 1} упражнения ${exercise.name}`}
                            onChange={(e) =>
                              updateSetValue(exercise.id, set.id, 'reps', e.target.value)
                            }
                          />
                        </div>
                        <div className="set-col-rir">
                          <button
                            type="button"
                            className={`btn-rir-selector ${
                              set.rir !== undefined && set.rir !== null ? 'rir-active' : ''
                            }`}
                            onClick={() => handleOpenRirPicker(exercise.id, set.id, set.rir)}
                            title="Запас повторений (RIR: 0 = отказ)"
                            aria-label={`Запас повторений RIR для подхода ${setIndex + 1}`}
                          >
                            {set.rir !== undefined && set.rir !== null
                              ? set.rir === 0
                                ? '0 🔥'
                                : `${set.rir}`
                              : '—'}
                          </button>
                        </div>
                        <div className="set-col-check">
                          <button
                            type="button"
                            className={`btn-check-set ${set.completed ? 'checked' : ''}`}
                            onClick={() => toggleSetComplete(exercise.id, set.id, setIndex)}
                            aria-label={`Отметить подход ${setIndex + 1} выполненным`}
                          >
                            {set.completed ? '✓' : '◯'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="exercise-card-footer">
                  <button className="btn-add-set" onClick={() => addSetToExercise(exercise.id)}>
                    + Подход
                  </button>
                  {exercise.sets.length > 1 && (
                    <button
                      className="btn-del-last-set"
                      onClick={() =>
                        removeSetFromExercise(
                          exercise.id,
                          exercise.sets[exercise.sets.length - 1].id
                        )
                      }
                    >
                      - Удалить подход
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {draft.exercises.length > 0 && (
          <button className="btn-add-exercise-block" onClick={() => setShowAddModal(true)}>
            + Добавить упражнение
          </button>
        )}
      </div>

      {/* Плавающий таймер отдыха */}
      {restSecondsLeft !== null && (
        <div className="floating-rest-timer">
          <div className="rest-timer-info">
            <span className="rest-timer-icon">⏱️</span>
            <div>
              <div className="rest-timer-label">Отдых между сетами</div>
              <div className="rest-timer-time">{formatDuration(restSecondsLeft)}</div>
            </div>
          </div>
          <div className="rest-timer-controls">
            <button
              className="btn-rest-add30"
              onClick={() => setRestSecondsLeft((s) => (s ?? 0) + 30)}
            >
              +30с
            </button>
            <button className="btn-rest-skip" onClick={() => setRestSecondsLeft(null)}>
              Пропуск
            </button>
          </div>
        </div>
      )}

      {/* Шторка добавления упражнения */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>Выбор упражнения</h3>
              <button className="btn-close-sheet" onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>

            <input
              type="text"
              className="sheet-search-input"
              placeholder="Поиск упражнения..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            {/* Быстрые фильтры по группам мышц */}
            <div className="sheet-muscle-chips">
              {MUSCLE_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  className={`muscle-chip ${selectedMuscle === group ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMuscle(group);
                    haptic('light');
                  }}
                >
                  {group}
                </button>
              ))}
            </div>

            {/* Быстрый ввод своего названия */}
            {searchQuery.trim() && !filteredCatalog.includes(searchQuery.trim()) && (
              <div
                className="custom-exercise-item"
                onClick={() => addExerciseToDraft(searchQuery.trim())}
              >
                <span>➕ Создать «{searchQuery.trim()}»</span>
              </div>
            )}

            <div className="sheet-catalog-list">
              {filteredCatalog.length === 0 ? (
                <div style={{ padding: '16px', color: '#8a8f98', textAlign: 'center' }}>
                  Ничего не найдено. Нажми «Создать», чтобы добавить своё.
                </div>
              ) : (
                filteredCatalog.map((name) => (
                  <div
                    key={name}
                    className="catalog-item-row"
                    onClick={() => addExerciseToDraft(name)}
                  >
                    <span>{name}</span>
                    <span className="catalog-item-plus">+</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модалка завершения тренировки */}
      {showFinishModal && (
        <div className="modal-overlay">
          <div className="finish-modal" onClick={(e) => e.stopPropagation()}>
            {finishResult ? (
              <div className="finish-success-view">
                <div className="finish-trophy">🏆</div>
                <h2>Тренировка завершена!</h2>
                <p className="subtitle">{finishResult.summaryText}</p>

                {finishResult.newPrs.length > 0 && (
                  <div className="new-prs-block">
                    <div className="new-prs-title">💥 Новые личные рекорды!</div>
                    {finishResult.newPrs.map((pr) => (
                      <div key={pr.exercise} className="pr-item">
                        <span className="pr-exercise">{pr.exercise}</span>
                        <span className="pr-val">
                          1RM: {pr.oneRepMax} кг (+{(pr.oneRepMax - pr.prevOneRepMax).toFixed(1)} кг)
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="share-actions-row">
                  <button
                    type="button"
                    className="btn-share-story"
                    disabled={generatingShareCard}
                    onClick={handleShareStory}
                    aria-label="Поделиться карточкой тренировки в Stories"
                  >
                    {generatingShareCard ? 'Генерация Stories...' : '📸 Поделиться в Stories'}
                  </button>
                  <button
                    type="button"
                    className="btn-copy-summary"
                    onClick={handleCopySummary}
                    aria-label="Скопировать текстовую сводку тренировки"
                  >
                    {copiedSummary ? '✓ Скопировано в буфер!' : '📋 Скопировать текст'}
                  </button>
                </div>

                <button
                  className="btn-finish-confirm"
                  style={{ marginTop: '14px' }}
                  onClick={() => {
                    setShowFinishModal(false);
                    setDraft(null);
                    if (onGoToHistory) onGoToHistory();
                  }}
                >
                  Перейти в дневник ➔
                </button>
              </div>
            ) : (
              <div>
                <h2>Завершить тренировку?</h2>
                <div className="finish-summary-stats">
                  <div className="stat-card">
                    <span className="stat-label">Время</span>
                    <span className="stat-value">{Math.round(elapsedSeconds / 60)} мин</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Тоннаж</span>
                    <span className="stat-value">{currentVolume} кг</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Упражнений</span>
                    <span className="stat-value">{draft.exercises.length}</span>
                  </div>
                </div>

                <div className="template-checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={saveAsTemplate}
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    />
                    <span>Сохранить эту тренировку как шаблон</span>
                  </label>
                  {saveAsTemplate && (
                    <input
                      type="text"
                      className="template-name-input"
                      placeholder="Название шаблона (напр. Спина + Бицепс)"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                  )}
                </div>

                <div className="finish-modal-actions">
                  <button
                    className="btn-finish-confirm"
                    disabled={savingWorkout}
                    onClick={handleSaveWorkout}
                  >
                    {savingWorkout ? 'Сохранение...' : 'Завершить и сохранить 🏁'}
                  </button>
                  <button
                    className="btn-finish-back"
                    disabled={savingWorkout}
                    onClick={() => setShowFinishModal(false)}
                  >
                    Вернуться к тренировке
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модалка калькулятора блинов */}
      {activePlateCalc && (
        <div className="plates-modal-overlay" onClick={() => setActivePlateCalc(null)}>
          <div className="plates-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="plates-modal-header">
              <div className="plates-modal-title">
                <span>🥞 Калькулятор блинов</span>
              </div>
              <button
                type="button"
                className="btn-finish-back"
                onClick={() => setActivePlateCalc(null)}
                aria-label="Закрыть калькулятор блинов"
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label
                style={{
                  fontSize: '12px',
                  color: 'var(--tg-hint)',
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                ВЕС ШТАНГИ (КГ):
              </label>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                className="set-input"
                style={{ fontSize: '18px', minHeight: '44px' }}
                value={activePlateCalc.currentWeight || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setActivePlateCalc((prev) => (prev ? { ...prev, currentWeight: val } : null));
                }}
                aria-label="Целевой вес штанги в кг"
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label
                style={{
                  fontSize: '11px',
                  color: 'var(--tg-hint)',
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                ГРИФ:
              </label>
              <div className="bar-selector">
                {BAR_WEIGHT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`bar-opt-btn ${
                      activePlateCalc.barWeight === opt.weight ? 'active' : ''
                    }`}
                    onClick={() => {
                      haptic('light');
                      setActivePlateCalc((prev) =>
                        prev ? { ...prev, barWeight: opt.weight } : null
                      );
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Раскладка блинов с каждой стороны */}
            {(() => {
              const res = calculatePlates(
                activePlateCalc.currentWeight,
                activePlateCalc.barWeight
              );
              const warmups = calculateWarmupSets(
                activePlateCalc.currentWeight,
                activePlateCalc.barWeight
              );

              return (
                <>
                  <div className="plates-visual-container">
                    <div className="plates-side-title">
                      С каждой стороны: {res.weightPerSideKg} кг
                    </div>
                    <div className="plates-side-chips">
                      {res.platesPerSide.length === 0 ? (
                        <span style={{ fontSize: '13px', color: 'var(--tg-hint)' }}>
                          Пустой гриф
                        </span>
                      ) : (
                        res.platesPerSide.map((p) => {
                          const chipClass = `plate-${String(p.plateKg).replace('.', '-')}`;
                          return Array.from({ length: p.countPerSide }).map((_, idx) => (
                            <span key={`${p.plateKg}-${idx}`} className={`plate-chip ${chipClass}`}>
                              {p.plateKg}
                            </span>
                          ));
                        })
                      )}
                    </div>
                    {res.remainderKg > 0 && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--pr)',
                          marginTop: '8px',
                          fontWeight: 700,
                        }}
                      >
                        ⚠️ Не хватает блинов на {res.remainderKg} кг
                      </div>
                    )}
                  </div>

                  {/* Пирамида разминки */}
                  <div className="warmup-pyramid">
                    <div className="warmup-pyramid-title">Разминочные подходы:</div>
                    {warmups.map((w) => (
                      <div key={w.setNumber} className="warmup-step-row">
                        <div>
                          <span className="warmup-step-weight">{w.weightKg} кг</span>
                          <span style={{ color: 'var(--tg-hint)', marginLeft: '6px' }}>
                            × {w.reps} повт.
                          </span>
                        </div>
                        <span style={{ color: 'var(--tg-hint)', fontSize: '11px' }}>{w.note}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <button
                      type="button"
                      className="btn-finish-confirm"
                      onClick={() => {
                        haptic('medium');
                        if (draft && activePlateCalc.currentWeight > 0) {
                          updateDraft({
                            ...draft,
                            exercises: draft.exercises.map((e) => {
                              if (e.id !== activePlateCalc.exerciseId) return e;
                              return {
                                ...e,
                                sets: e.sets.map((s) =>
                                  s.completed
                                    ? s
                                    : { ...s, weight: activePlateCalc.currentWeight }
                                ),
                              };
                            }),
                          });
                        }
                        setActivePlateCalc(null);
                      }}
                    >
                      Применить вес ({activePlateCalc.currentWeight} кг)
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Модалка RIR селектора */}
      {rirPickerTarget && (
        <div className="rir-modal-overlay" onClick={() => setRirPickerTarget(null)}>
          <div className="rir-picker-card" onClick={(e) => e.stopPropagation()}>
            <div className="rir-picker-title">Запас повторений (RIR)</div>
            <div className="rir-picker-desc">
              Сколько повторений ты мог ещё сделать до отказа?
            </div>

            <div className="rir-options-grid">
              <button
                type="button"
                className={`rir-opt-card ${rirPickerTarget.currentRir === 0 ? 'active' : ''}`}
                onClick={() => handleSelectRir(0)}
              >
                <span className="rir-val">0 🔥</span>
                <span className="rir-hint">Отказ / Предел</span>
              </button>
              <button
                type="button"
                className={`rir-opt-card ${rirPickerTarget.currentRir === 1 ? 'active' : ''}`}
                onClick={() => handleSelectRir(1)}
              >
                <span className="rir-val">1</span>
                <span className="rir-hint">Тяжело (1 в запасе)</span>
              </button>
              <button
                type="button"
                className={`rir-opt-card ${rirPickerTarget.currentRir === 2 ? 'active' : ''}`}
                onClick={() => handleSelectRir(2)}
              >
                <span className="rir-val">2</span>
                <span className="rir-hint">Рабочий (2 в запасе)</span>
              </button>
              <button
                type="button"
                className={`rir-opt-card ${rirPickerTarget.currentRir === 3 ? 'active' : ''}`}
                onClick={() => handleSelectRir(3)}
              >
                <span className="rir-val">3+</span>
                <span className="rir-hint">Легко / Запас 3+</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-finish-back"
                style={{ flex: 1, minHeight: '40px' }}
                onClick={() => handleSelectRir(null)}
              >
                Сбросить
              </button>
              <button
                type="button"
                className="btn-finish-back"
                style={{ flex: 1, minHeight: '40px', color: 'var(--tg-text)' }}
                onClick={() => setRirPickerTarget(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
