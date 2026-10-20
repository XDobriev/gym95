import { Goal, Sex } from '../types/profile';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: '🍳 Завтрак',
  lunch: '🍲 Обед',
  dinner: '🍽 Ужин',
  snack: '🍎 Перекус',
};

const MEAL_WORDS: Record<string, Meal> = {
  завтрак: 'breakfast',
  обед: 'lunch',
  ужин: 'dinner',
  перекус: 'snack',
};

export interface FoodLine {
  meal: Meal | null;
  description: string | null;
  kcal: number;
  yesterday: boolean;
}

const MIN_KCAL = 20;
const MAX_KCAL = 5000;

// «обед 650», «перекус 2 яблока 190», «ужин: паста 820 ккал», «вчера ужин 700».
// null — не похоже на еду (нужно хотя бы одно слово и число ккал в конце).
export function parseFoodLine(text: string): FoodLine | null {
  let t = text.trim().replace(/\s+/g, ' ');
  let yesterday = false;
  if (/^вчера\s/i.test(t)) {
    yesterday = true;
    t = t.slice(6).trim();
  }

  const m = /^(.*?)[\s,:—-]+(\d{2,4})\s*(?:ккал|кк|kcal)?\.?$/i.exec(t);
  if (!m) return null;
  const kcal = Number(m[2]);
  if (kcal < MIN_KCAL || kcal > MAX_KCAL) return null;

  let rest = m[1].trim().replace(/[:,—-]+$/, '').trim();
  if (!/\p{L}/u.test(rest)) return null;

  let meal: Meal | null = null;
  const first = rest.split(' ')[0].toLowerCase().replace(/[:,]$/, '');
  if (MEAL_WORDS[first]) {
    meal = MEAL_WORDS[first];
    rest = rest.slice(rest.split(' ')[0].length).replace(/^[\s:,—-]+/, '').trim();
  }

  return { meal, description: rest.length ? rest : null, kcal, yesterday };
}

const ACTIVITY_FACTOR = 1.375; // лёгкая активность: тренировки 2–3 раза в неделю
const GOAL_DELTA: Record<Goal, number> = { lose: -500, gain: 300, regular: 0 };

// Суточная норма по Миффлину — Сан-Жеору с поправкой на цель, кратно 25 ккал.
// При похудении норма не опускается ниже основного обмена (BMR).
export function kcalNorm(p: { sex: Sex; weightKg: number; heightCm: number; age: number; goal: Goal }): number {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const target = Math.max(bmr, bmr * ACTIVITY_FACTOR + GOAL_DELTA[p.goal]);
  return Math.round(target / 25) * 25;
}

// Средние ккал в день по дням, где есть хоть одна запись (пропущенные дни не тянут среднее вниз).
export function averagePerDay(entries: { eaten_on: string; kcal: number }[]): number | null {
  const byDay = new Map<string, number>();
  for (const e of entries) byDay.set(e.eaten_on, (byDay.get(e.eaten_on) ?? 0) + e.kcal);
  if (byDay.size === 0) return null;
  return Math.round([...byDay.values()].reduce((a, b) => a + b, 0) / byDay.size);
}

export function formatKcal(n: number): string {
  return n.toLocaleString('ru-RU');
}
