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
  const config = {
    type: 'line',
    data: {
      labels: history.map((entry) => formatDateShortRu(entry.date)),
      datasets: [
        {
          label: exerciseName,
          data: history.map((entry) => maxWeight(entry.sets)),
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f6',
          fill: false,
          tension: 0.2,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      title: { display: true, text: exerciseName },
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
