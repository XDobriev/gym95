import { getFoodBetween, FoodEntry } from '../db/food';
import { getLatestWeight, getProfile } from '../db/profiles';
import { addDays } from '../utils/time';
import { averagePerDay, formatKcal, kcalNorm, Meal, MEAL_LABELS } from '../utils/food';
import { pluralizeRu } from '../utils/format';

// Норма по профилю и последнему весу. null — профиля нет.
export async function getKcalNorm(userId: number): Promise<number | null> {
  const [profile, weight] = await Promise.all([getProfile(userId), getLatestWeight(userId)]);
  if (!profile || weight === null) return null;
  return kcalNorm({
    sex: profile.sex,
    weightKg: weight,
    heightCm: profile.height_cm,
    age: new Date().getFullYear() - profile.birth_year,
    goal: profile.goal,
  });
}

export function entryLabel(e: Pick<FoodEntry, 'meal' | 'description'>): string {
  const meal = e.meal ? MEAL_LABELS[e.meal as Meal] : '🍽';
  return e.description ? `${meal} · ${e.description}` : meal;
}

const entriesWord = (n: number) => pluralizeRu(n, ['запись', 'записи', 'записей']);

export function dayTotalLine(entries: FoodEntry[], norm: number | null): string {
  const total = entries.reduce((s, e) => s + e.kcal, 0);
  return `${formatKcal(total)}${norm ? ` / ${formatKcal(norm)}` : ''} ккал (${entries.length} ${entriesWord(entries.length)})`;
}

export async function foodTodaySection(userId: number, todayStr: string): Promise<string> {
  const [entries, norm] = await Promise.all([getFoodBetween(userId, todayStr, todayStr), getKcalNorm(userId)]);
  if (entries.length === 0) return `🍽 Еда сегодня не записана — напиши, например: обед 650${norm ? `\n   Норма: ${formatKcal(norm)} ккал` : ''}`;
  return `🍽 Еда: ${dayTotalLine(entries, norm)}`;
}

export async function foodYesterdayLine(userId: number, yesterday: string): Promise<string> {
  const entries = await getFoodBetween(userId, yesterday, yesterday);
  if (entries.length === 0) return '🍽 Еда не записана';
  const norm = await getKcalNorm(userId);
  return `🍽 Еда: ${dayTotalLine(entries, norm)}`;
}

export async function foodAverages(userId: number, todayStr: string): Promise<{ avg7: number | null; avg30: number | null }> {
  const entries = await getFoodBetween(userId, addDays(todayStr, -29), todayStr);
  const from7 = addDays(todayStr, -6);
  return { avg7: averagePerDay(entries.filter((e) => e.eaten_on >= from7)), avg30: averagePerDay(entries) };
}

export interface FrequentDish {
  meal: Meal | null;
  description: string;
  kcal: number;
}

// Частые блюда за 30 дней: с описанием, встречались ≥2 раз; ккал — из последней записи.
export async function frequentDishes(userId: number, todayStr: string, limit = 6): Promise<FrequentDish[]> {
  const entries = await getFoodBetween(userId, addDays(todayStr, -29), todayStr);
  const groups = new Map<string, { dish: FrequentDish; count: number; last: string }>();
  for (const e of entries) {
    if (!e.description) continue;
    const key = `${e.meal ?? ''}|${e.description.toLowerCase()}`;
    const g = groups.get(key);
    const stamp = `${e.eaten_on}|${e.created_at}`;
    if (!g) groups.set(key, { dish: { meal: e.meal, description: e.description, kcal: e.kcal }, count: 1, last: stamp });
    else {
      g.count++;
      if (stamp > g.last) {
        g.last = stamp;
        g.dish.kcal = e.kcal;
      }
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1))
    .slice(0, limit)
    .map((g) => g.dish);
}
