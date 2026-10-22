// Web Audio API синтезатор для сигналов таймера и секундомера
// Не требует скачивания внешних mp3-файлов, работает автономно

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Разблокирует AudioContext при пользовательском жесте (тапе/клике) */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => undefined);
  }
}

export function playBeep(freq = 880, duration = 0.15, type: OscillatorType = 'sine'): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // silence any audio restrictions
  }
}

/** Короткий предупреждающий сигнал (3, 2, 1 сек) */
export function playCountdownBeep(): void {
  playBeep(650, 0.12, 'sine');
}

/** Торжественный / акцентный двойной сигнал об окончании раунда или отдыха */
export function playFinishedBeep(): void {
  playBeep(1000, 0.2, 'triangle');
  setTimeout(() => {
    playBeep(1350, 0.3, 'triangle');
  }, 140);
}
