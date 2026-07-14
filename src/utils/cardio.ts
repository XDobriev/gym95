// Средний темп в формате "мин:сек /км", null если дистанция не указана.
export function computeAvgPace(durationMinutes: number, distanceKm: number | null): string | null {
  if (!distanceKm || distanceKm <= 0) return null;

  const paceMinutesPerKm = durationMinutes / distanceKm;
  const minutes = Math.floor(paceMinutesPerKm);
  let seconds = Math.round((paceMinutesPerKm - minutes) * 60);

  let finalMinutes = minutes;
  if (seconds === 60) {
    finalMinutes += 1;
    seconds = 0;
  }

  return `${finalMinutes}:${String(seconds).padStart(2, '0')} /км`;
}
