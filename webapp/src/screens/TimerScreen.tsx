import { useState, useEffect, useRef, useMemo } from 'react';
import { haptic, notifyHaptic } from '../telegram';
import { playCountdownBeep, playFinishedBeep, unlockAudio } from '../sound';

type TimerMode = 'rest' | 'laps' | 'hiit';

interface LapRecord {
  lapNumber: number;
  lapTimeMs: number;
  totalTimeMs: number;
  distanceKm: number;
}

export function TimerScreen() {
  const [mode, setMode] = useState<TimerMode>('rest');

  // =================== РЕЖИМ 1: ТАЙМЕР ОТДЫХА ===================
  const REST_PRESETS = [30, 60, 90, 120, 180];
  const [restDuration, setRestDuration] = useState<number>(60);
  const [restTimeLeft, setRestTimeLeft] = useState<number>(60);
  const [restRunning, setRestRunning] = useState<boolean>(false);
  const [restFinished, setRestFinished] = useState<boolean>(false);
  const restTimerRef = useRef<number | null>(null);

  const startRestTimer = (seconds?: number) => {
    unlockAudio();
    setRestFinished(false);
    const dur = seconds ?? (restTimeLeft === 0 ? restDuration : restTimeLeft);
    if (dur <= 0) return;
    setRestTimeLeft(dur);
    setRestRunning(true);
    haptic('medium');
  };

  const pauseRestTimer = () => {
    setRestRunning(false);
    haptic('light');
  };

  const resetRestTimer = (seconds?: number) => {
    setRestRunning(false);
    setRestFinished(false);
    const target = seconds ?? restDuration;
    setRestTimeLeft(target);
    haptic('light');
  };

  const addRestTime = (deltaSec: number) => {
    unlockAudio();
    setRestFinished(false);
    haptic('light');
    setRestTimeLeft((prev) => Math.max(0, prev + deltaSec));
  };

  useEffect(() => {
    if (!restRunning) {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      return;
    }

    restTimerRef.current = window.setInterval(() => {
      setRestTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(restTimerRef.current!);
          setRestRunning(false);
          setRestFinished(true);
          playFinishedBeep();
          notifyHaptic('success');
          setTimeout(() => haptic('heavy'), 300);
          return 0;
        }
        if (prev <= 4) {
          playCountdownBeep();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [restRunning]);

  // =================== РЕЖИМ 2: СЕКУНДОМЕР И КРУГИ НА СТАДИОНЕ ===================
  const [lapStopwatchRunning, setLapStopwatchRunning] = useState<boolean>(false);
  const [lapElapsedMs, setLapElapsedMs] = useState<number>(0);
  const [laps, setLaps] = useState<LapRecord[]>([]);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const stopwatchStartTimeRef = useRef<number>(0);
  const stopwatchTimerRef = useRef<number | null>(null);
  const lastLapTotalMsRef = useRef<number>(0);

  const startStopwatch = () => {
    unlockAudio();
    haptic('medium');
    stopwatchStartTimeRef.current = Date.now() - lapElapsedMs;
    setLapStopwatchRunning(true);
  };

  const pauseStopwatch = () => {
    haptic('light');
    setLapStopwatchRunning(false);
  };

  const resetStopwatch = () => {
    haptic('light');
    setLapStopwatchRunning(false);
    setLapElapsedMs(0);
    setLaps([]);
    lastLapTotalMsRef.current = 0;
  };

  const recordLap = () => {
    if (!lapStopwatchRunning && lapElapsedMs === 0) return;
    haptic('medium');
    const currentTotal = lapElapsedMs;
    const lapTime = currentTotal - lastLapTotalMsRef.current;
    lastLapTotalMsRef.current = currentTotal;

    const nextLapNum = laps.length + 1;
    const distKm = Number((nextLapNum * 0.4).toFixed(2)); // 400 метров круг

    setLaps((prev) => [
      {
        lapNumber: nextLapNum,
        lapTimeMs: lapTime,
        totalTimeMs: currentTotal,
        distanceKm: distKm,
      },
      ...prev,
    ]);
  };

  useEffect(() => {
    if (!lapStopwatchRunning) {
      if (stopwatchTimerRef.current) cancelAnimationFrame(stopwatchTimerRef.current);
      return;
    }

    const tick = () => {
      setLapElapsedMs(Date.now() - stopwatchStartTimeRef.current);
      stopwatchTimerRef.current = requestAnimationFrame(tick);
    };
    stopwatchTimerRef.current = requestAnimationFrame(tick);

    return () => {
      if (stopwatchTimerRef.current) cancelAnimationFrame(stopwatchTimerRef.current);
    };
  }, [lapStopwatchRunning]);

  const bestLapMs = useMemo(() => {
    if (laps.length === 0) return null;
    return Math.min(...laps.map((l) => l.lapTimeMs));
  }, [laps]);

  const copyLapsSummary = () => {
    if (laps.length === 0) return;
    haptic('light');
    const totalLapCount = laps.length;
    const totalDistKm = (totalLapCount * 0.4).toFixed(1);
    const totalSec = Math.floor(lapElapsedMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    const text = `Ходьба / Стадион: ${totalLapCount} кругов (${totalDistKm} км) за ${timeStr}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    });
  };

  // =================== РЕЖИМ 3: ИНТЕРВАЛЫ HIIT / ТАБАТА ===================
  const [workSec, setWorkSec] = useState<number>(20);
  const [restSec, setRestSec] = useState<number>(10);
  const [totalRounds, setTotalRounds] = useState<number>(8);

  const [currentRound, setCurrentRound] = useState<number>(1);
  const [intervalPhase, setIntervalPhase] = useState<'work' | 'rest' | 'finished'>('work');
  const [intervalTimeLeft, setIntervalTimeLeft] = useState<number>(20);
  const [intervalRunning, setIntervalRunning] = useState<boolean>(false);
  const intervalTimerRef = useRef<number | null>(null);

  const startHiit = () => {
    unlockAudio();
    haptic('medium');
    if (intervalPhase === 'finished') {
      setCurrentRound(1);
      setIntervalPhase('work');
      setIntervalTimeLeft(workSec);
    }
    setIntervalRunning(true);
  };

  const pauseHiit = () => {
    haptic('light');
    setIntervalRunning(false);
  };

  const resetHiit = () => {
    haptic('light');
    setIntervalRunning(false);
    setCurrentRound(1);
    setIntervalPhase('work');
    setIntervalTimeLeft(workSec);
  };

  useEffect(() => {
    if (!intervalRunning) {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      return;
    }

    intervalTimerRef.current = window.setInterval(() => {
      setIntervalTimeLeft((prev) => {
        if (prev <= 1) {
          // Смена фазы
          if (intervalPhase === 'work') {
            if (currentRound >= totalRounds) {
              setIntervalPhase('finished');
              setIntervalRunning(false);
              playFinishedBeep();
              notifyHaptic('success');
              return 0;
            } else {
              setIntervalPhase('rest');
              playFinishedBeep();
              notifyHaptic('warning');
              return restSec;
            }
          } else if (intervalPhase === 'rest') {
            setCurrentRound((r) => r + 1);
            setIntervalPhase('work');
            playFinishedBeep();
            notifyHaptic('warning');
            return workSec;
          }
          return 0;
        }

        if (prev <= 4) {
          playCountdownBeep();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    };
  }, [intervalRunning, intervalPhase, currentRound, totalRounds, workSec, restSec]);

  // Хелперы форматирования времени
  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatStopwatchTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${tenths}`;
  };

  return (
    <div className="timer-screen">
      {/* Переключатель режимов таймера */}
      <div className="timer-mode-selector">
        <button
          className={`timer-mode-btn ${mode === 'rest' ? 'active' : ''}`}
          onClick={() => {
            haptic('light');
            setMode('rest');
          }}
        >
          ⏱ Отдых
        </button>
        <button
          className={`timer-mode-btn ${mode === 'laps' ? 'active' : ''}`}
          onClick={() => {
            haptic('light');
            setMode('laps');
          }}
        >
          🏟 Стадион
        </button>
        <button
          className={`timer-mode-btn ${mode === 'hiit' ? 'active' : ''}`}
          onClick={() => {
            haptic('light');
            setMode('hiit');
          }}
        >
          ⚡ Табата / HIIT
        </button>
      </div>

      {/* ================= РЕЖИМ 1: ТАЙМЕР ОТДЫХА ================= */}
      {mode === 'rest' && (
        <div className="timer-card">
          <div className="timer-presets">
            {REST_PRESETS.map((sec) => (
              <button
                key={sec}
                className={`preset-btn ${restDuration === sec && !restRunning ? 'selected' : ''}`}
                onClick={() => {
                  unlockAudio();
                  setRestDuration(sec);
                  resetRestTimer(sec);
                }}
              >
                {sec}с
              </button>
            ))}
          </div>

          {restFinished && (
            <div className="timer-finished-banner">
              🔔 Отдых завершён! Время следующего подхода!
            </div>
          )}

          <div className={`circular-timer-container ${restFinished ? 'finished' : ''}`}>
            <svg className="timer-svg" viewBox="0 0 200 200">
              <circle className="timer-circle-bg" cx="100" cy="100" r="85" />
              <circle
                className="timer-circle-fg"
                cx="100"
                cy="100"
                r="85"
                style={{
                  strokeDasharray: 534,
                  strokeDashoffset:
                    534 - (534 * (restDuration > 0 ? restTimeLeft / restDuration : 0)),
                }}
              />
            </svg>
            <div className="timer-center-content">
              <div className="timer-digits">{formatTime(restTimeLeft)}</div>
              <div className="timer-sublabel">
                {restRunning ? 'ОТДЫХ ИДЁТ' : restTimeLeft === 0 ? 'ГОТОВ К ПОДХОДУ!' : 'ПАУЗА'}
              </div>
            </div>
          </div>

          <div className="timer-adjust-row">
            <button className="adjust-btn" onClick={() => addRestTime(-15)}>
              -15с
            </button>
            <button className="adjust-btn" onClick={() => addRestTime(15)}>
              +15с
            </button>
            <button className="adjust-btn" onClick={() => addRestTime(30)}>
              +30с
            </button>
          </div>

          <div className="timer-actions">
            {!restRunning ? (
              <button className="timer-main-btn start" onClick={() => startRestTimer()}>
                {restTimeLeft === 0 ? 'Заново' : 'Старт'}
              </button>
            ) : (
              <button className="timer-main-btn pause" onClick={pauseRestTimer}>
                Пауза
              </button>
            )}
            <button className="timer-secondary-btn" onClick={() => resetRestTimer()}>
              Сброс
            </button>
          </div>
        </div>
      )}

      {/* ================= РЕЖИМ 2: СЕКУНДОМЕР И КРУГИ НА СТАДИОНЕ ================= */}
      {mode === 'laps' && (
        <div className="timer-card">
          <div className="stopwatch-display">
            <div className="stopwatch-digits">{formatStopwatchTime(lapElapsedMs)}</div>
            <div className="stopwatch-summary">
              <span>🏟 {laps.length} кругов</span>
              <span>•</span>
              <span>{(laps.length * 0.4).toFixed(2)} км</span>
            </div>
          </div>

          <div className="timer-actions">
            {!lapStopwatchRunning ? (
              <button className="timer-main-btn start" onClick={startStopwatch}>
                {lapElapsedMs === 0 ? 'Старт' : 'Продолжить'}
              </button>
            ) : (
              <button className="timer-main-btn pause" onClick={pauseStopwatch}>
                Пауза
              </button>
            )}
            <button
              className="timer-secondary-btn lap-btn"
              disabled={!lapStopwatchRunning && lapElapsedMs === 0}
              onClick={recordLap}
            >
              + Круг (400м)
            </button>
            <button className="timer-secondary-btn" onClick={resetStopwatch}>
              Сброс
            </button>
          </div>

          {laps.length > 0 && (
            <div className="laps-section">
              <div className="laps-header">
                <h3>Засечки кругов</h3>
                <button className="copy-laps-btn" onClick={copyLapsSummary}>
                  {copiedToast ? 'Скопировано! ✓' : '📋 Скопировать'}
                </button>
              </div>

              <div className="laps-table">
                <div className="lap-row head">
                  <span>Круг</span>
                  <span>Время круга</span>
                  <span>Дистанция</span>
                  <span>Всего</span>
                </div>
                {laps.map((lap) => {
                  const isBest = bestLapMs !== null && lap.lapTimeMs === bestLapMs && laps.length > 1;
                  return (
                    <div key={lap.lapNumber} className={`lap-row ${isBest ? 'best-lap' : ''}`}>
                      <span className="lap-num">
                        #{lap.lapNumber} {isBest && '⚡'}
                      </span>
                      <span className="lap-time">{formatStopwatchTime(lap.lapTimeMs)}</span>
                      <span className="lap-dist">{lap.distanceKm.toFixed(1)} км</span>
                      <span className="lap-total">{formatStopwatchTime(lap.totalTimeMs)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= РЕЖИМ 3: ИНТЕРВАЛЫ HIIT / ТАБАТА ================= */}
      {mode === 'hiit' && (
        <div className="timer-card">
          {!intervalRunning && intervalPhase !== 'finished' && (
            <div className="hiit-settings">
              <div className="setting-box">
                <label>Работа (сек)</label>
                <div className="counter-controls">
                  <button onClick={() => setWorkSec((s) => Math.max(5, s - 5))}>-</button>
                  <span>{workSec}с</span>
                  <button onClick={() => setWorkSec((s) => s + 5)}>+</button>
                </div>
              </div>
              <div className="setting-box">
                <label>Отдых (сек)</label>
                <div className="counter-controls">
                  <button onClick={() => setRestSec((s) => Math.max(5, s - 5))}>-</button>
                  <span>{restSec}с</span>
                  <button onClick={() => setRestSec((s) => s + 5)}>+</button>
                </div>
              </div>
              <div className="setting-box">
                <label>Раунды</label>
                <div className="counter-controls">
                  <button onClick={() => setTotalRounds((r) => Math.max(1, r - 1))}>-</button>
                  <span>{totalRounds}</span>
                  <button onClick={() => setTotalRounds((r) => r + 1)}>+</button>
                </div>
              </div>
            </div>
          )}

          <div
            className={`hiit-banner ${
              intervalPhase === 'work' ? 'work' : intervalPhase === 'rest' ? 'rest' : 'finished'
            }`}
          >
            <div className="hiit-phase-title">
              {intervalPhase === 'work'
                ? '🔥 РАБОТА'
                : intervalPhase === 'rest'
                ? '💧 ОТДЫХ'
                : '🏆 ТРЕНИРОВКА ЗАВЕРШЕНА!'}
            </div>
            <div className="hiit-round-info">
              {intervalPhase !== 'finished' && `Раунд ${currentRound} из ${totalRounds}`}
            </div>
          </div>

          <div className="hiit-digits-container">
            <div className="timer-digits">{formatTime(intervalTimeLeft)}</div>
          </div>

          <div className="timer-actions">
            {!intervalRunning ? (
              <button className="timer-main-btn start" onClick={startHiit}>
                {intervalPhase === 'finished' ? 'Заново' : 'Старт'}
              </button>
            ) : (
              <button className="timer-main-btn pause" onClick={pauseHiit}>
                Пауза
              </button>
            )}
            <button className="timer-secondary-btn" onClick={resetHiit}>
              Сброс
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

