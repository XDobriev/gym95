import { SetEntry } from '../types/domain';
import { formatDateShortRu } from './format';

const QUICKCHART_BASE_URL = 'https://quickchart.io/chart';

function maxWeight(sets: SetEntry[]): number {
  return Math.max(...sets.map((set) => set.weight));
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
