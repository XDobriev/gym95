import { SetEntry } from '../types/domain';
import { formatDateShortRu } from './format';

const QUICKCHART_BASE_URL = 'https://quickchart.io/chart';

function maxWeight(sets: SetEntry[]): number {
  return Math.max(...sets.map((set) => set.weight));
}

// График веса по дням: точки взвешиваний (по одной на день). labels — дд.мм.
export function buildWeightChartUrl(days: { dateStr: string; kg: number }[]): string {
  const config = {
    type: 'line',
    data: {
      labels: days.map((d) => `${d.dateStr.slice(8)}.${d.dateStr.slice(5, 7)}`),
      datasets: [
        {
          label: 'Вес, кг',
          data: days.map((d) => d.kg),
          borderColor: '#7ea300',
          backgroundColor: '#c9ff2e',
          fill: false,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      title: { display: true, text: 'Вес, кг' },
    },
  };
  const params = new URLSearchParams({ c: JSON.stringify(config), backgroundColor: 'white', width: '600', height: '350' });
  return `${QUICKCHART_BASE_URL}?${params.toString()}`;
}

export function buildProgressChartUrl(
  exerciseName: string,
  history: { date: string; sets: SetEntry[] }[]
): string {
  const isBodyweight = history.every((entry) => entry.sets.every((s) => s.weight === 0));
  const data = isBodyweight
    ? history.map((entry) => (entry.sets.length ? Math.max(...entry.sets.map((s) => s.reps)) : 0))
    : history.map((entry) => maxWeight(entry.sets));
  const metricLabel = isBodyweight ? 'макс. повторения, шт' : 'макс. вес, кг';

  const config = {
    type: 'line',
    data: {
      labels: history.map((entry) => formatDateShortRu(entry.date)),
      datasets: [
        {
          label: `${exerciseName} (${metricLabel})`,
          data,
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f6',
          fill: false,
          tension: 0.2,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      title: { display: true, text: `${exerciseName} (${metricLabel})` },
    },
  };

  const params = new URLSearchParams({
    c: JSON.stringify(config),
    backgroundColor: 'white',
    width: '600',
    height: '350',
  });

  return `${QUICKCHART_BASE_URL}?${params.toString()}`;
}

export function buildCardioProgressChartUrl(
  activityName: string,
  history: { date: string; distanceKm: number | null; durationMinutes: number | null }[]
): string {
  const hasDistance = history.some((h) => h.distanceKm !== null && h.distanceKm > 0);
  const metricLabel = hasDistance ? 'дистанция, км' : 'длительность, мин';
  const data = history.map((h) => (hasDistance ? h.distanceKm ?? 0 : h.durationMinutes ?? 0));

  const config = {
    type: 'line',
    data: {
      labels: history.map((entry) => formatDateShortRu(entry.date)),
      datasets: [
        {
          label: `${activityName} (${metricLabel})`,
          data,
          borderColor: '#00e0a4',
          backgroundColor: '#00e0a4',
          fill: false,
          tension: 0.2,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      title: { display: true, text: `${activityName} (${metricLabel})` },
    },
  };

  const params = new URLSearchParams({
    c: JSON.stringify(config),
    backgroundColor: 'white',
    width: '600',
    height: '350',
  });

  return `${QUICKCHART_BASE_URL}?${params.toString()}`;
}
