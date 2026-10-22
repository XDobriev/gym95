import { CardioActivity } from '../types/domain';

export interface CardioSummaryInput {
  activity: CardioActivity;
  durationMinutes: number;
  distanceKm: number | null;
  weightKg?: number;
  totalPreviousLaps?: number;
}

export interface CardioSummaryResult {
  activity: CardioActivity;
  durationMinutes: number;
  distanceKm: number | null;
  laps: number | null;
  avgPace: string | null;
  burnedKcal: number;
  nextBadge: {
    title: string;
    targetLaps: number;
    currentLaps: number;
    lapsLeft: number;
    kmLeft: number;
  } | null;
  lines: string[];
}

export function estimateBurnedKcal(
  activity: CardioActivity,
  durationMinutes: number,
  distanceKm: number | null,
  weightKg = 80
): number {
  if (durationMinutes <= 0) return 0;

  let met = 5.0;
  if (activity === 'walking') {
    if (distanceKm && distanceKm > 0) {
      const speedKmH = (distanceKm / durationMinutes) * 60;
      if (speedKmH < 4.5) met = 3.5;
      else if (speedKmH <= 5.8) met = 4.3;
      else met = 5.0;
    } else {
      met = 4.0;
    }
  } else if (activity === 'running') {
    if (distanceKm && distanceKm > 0) {
      const speedKmH = (distanceKm / durationMinutes) * 60;
      if (speedKmH < 9) met = 8.3;
      else if (speedKmH <= 11) met = 9.8;
      else met = 11.5;
    } else {
      met = 9.0;
    }
  } else if (activity === 'treadmill') {
    met = 7.0;
  } else if (activity === 'bike') {
    met = 6.8;
  } else if (activity === 'pool') {
    met = 7.5;
  }

  const hours = durationMinutes / 60;
  return Math.round(met * weightKg * hours);
}

export function generateCardioSummary(input: CardioSummaryInput): CardioSummaryResult {
  const { activity, durationMinutes, distanceKm, weightKg = 80, totalPreviousLaps = 0 } = input;
  const burnedKcal = estimateBurnedKcal(activity, durationMinutes, distanceKm, weightKg);

  let laps: number | null = null;
  if (distanceKm && (activity === 'walking' || activity === 'running')) {
    laps = Math.round((distanceKm / 0.4) * 10) / 10;
  }

  let avgPace: string | null = null;
  if (distanceKm && distanceKm > 0 && durationMinutes > 0) {
    const paceMinPerKm = durationMinutes / distanceKm;
    const mins = Math.floor(paceMinPerKm);
    let secs = Math.round((paceMinPerKm - mins) * 60);
    let finalMins = mins;
    if (secs === 60) {
      finalMins += 1;
      secs = 0;
    }
    avgPace = `${finalMins}:${String(secs).padStart(2, '0')} /км`;
  }

  let nextBadge: CardioSummaryResult['nextBadge'] = null;
  if (laps !== null) {
    const newTotal = totalPreviousLaps + laps;
    if (newTotal < 10) {
      const left = Math.round((10 - newTotal) * 10) / 10;
      nextBadge = {
        title: '🥉 Первые круги',
        targetLaps: 10,
        currentLaps: newTotal,
        lapsLeft: left,
        kmLeft: Math.round(left * 0.4 * 10) / 10,
      };
    } else if (newTotal < 50) {
      const left = Math.round((50 - newTotal) * 10) / 10;
      nextBadge = {
        title: '🥈 Стадионный бегун',
        targetLaps: 50,
        currentLaps: newTotal,
        lapsLeft: left,
        kmLeft: Math.round(left * 0.4 * 10) / 10,
      };
    } else if (newTotal < 100) {
      const left = Math.round((100 - newTotal) * 10) / 10;
      nextBadge = {
        title: '🥇 Хозяин стадиона',
        targetLaps: 100,
        currentLaps: newTotal,
        lapsLeft: left,
        kmLeft: Math.round(left * 0.4 * 10) / 10,
      };
    }
  }

  const lines: string[] = [];
  if (laps !== null && distanceKm) {
    lines.push(`📏 ${laps} кругов (${distanceKm} км) за ${durationMinutes} мин`);
  } else if (distanceKm) {
    lines.push(`📏 ${distanceKm} км за ${durationMinutes} мин`);
  } else {
    lines.push(`🕒 Длительность: ${durationMinutes} мин`);
  }

  if (avgPace) {
    lines.push(`⚡ Средний темп: ${avgPace}`);
  }

  if (burnedKcal > 0) {
    lines.push(`🔥 Сожжено: ~${burnedKcal} ккал`);
  }

  if (nextBadge) {
    lines.push(`🎖 До ачивки «${nextBadge.title}»: ещё ${nextBadge.lapsLeft} кр (${nextBadge.kmLeft} км)`);
  } else if (laps !== null && totalPreviousLaps + laps >= 100) {
    lines.push(`🏆 Все ачивки стадиона получены (100+ кругов)!`);
  }

  return {
    activity,
    durationMinutes,
    distanceKm,
    laps,
    avgPace,
    burnedKcal,
    nextBadge,
    lines,
  };
}
