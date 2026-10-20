import { daysBetween } from './time';

export type BodyLineResult =
  | { ok: true; heightCm: number; weightKg: number; age: number }
  | { ok: false; error: string };

const BODY_EXAMPLE = 'Напиши рост (см), вес (кг) и возраст через пробел, например: 182 95 34';

// «182 95 34», «182 95,5 34», «182, 95.5, 34».
export function parseBodyLine(text: string): BodyLineResult {
  const tokens = text.trim().replace(/,\s+/g, ' ').split(/\s+/).filter(Boolean);
  if (tokens.length !== 3) return { ok: false, error: BODY_EXAMPLE };

  const nums = tokens.map((t) => Number(t.replace(',', '.')));
  if (nums.some((n) => !Number.isFinite(n))) return { ok: false, error: BODY_EXAMPLE };

  const [heightCm, weightRaw, age] = [Math.round(nums[0]), nums[1], Math.round(nums[2])];
  const weightKg = Math.round(weightRaw * 10) / 10;

  if (heightCm < 120 || heightCm > 230) return { ok: false, error: `Рост должен быть от 120 до 230 см. ${BODY_EXAMPLE}` };
  if (weightKg < 35 || weightKg > 300) return { ok: false, error: `Вес должен быть от 35 до 300 кг. ${BODY_EXAMPLE}` };
  if (age < 12 || age > 90) return { ok: false, error: `Возраст должен быть от 12 до 90 лет. ${BODY_EXAMPLE}` };

  return { ok: true, heightCm, weightKg, age };
}

export type CardioLineResult =
  | { ok: true; minutes: number; distanceKm: number | null }
  | { ok: false; error: string };

const CARDIO_EXAMPLE = 'Напиши минуты и километры через пробел, например: 48 4 (км можно не писать)';

// «48 4», «50 4,2», «45».
export function parseCardioLine(text: string): CardioLineResult {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 2) return { ok: false, error: CARDIO_EXAMPLE };

  const minutes = Number(tokens[0]);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) return { ok: false, error: CARDIO_EXAMPLE };

  if (tokens.length === 1) return { ok: true, minutes, distanceKm: null };

  const km = Number(tokens[1].replace(',', '.'));
  if (!Number.isFinite(km) || km <= 0 || km > 200) return { ok: false, error: CARDIO_EXAMPLE };
  return { ok: true, minutes, distanceKm: Math.round(km * 100) / 100 };
}

export type DayMonthResult = { ok: true; dateStr: string } | { ok: false; error: string };

const DATE_EXAMPLE = 'Напиши дату как дд.мм, например 18.10';
const MAX_DAYS_BACK = 365;

function isValidDate(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const pad = (n: number) => String(n).padStart(2, '0');

// «дд.мм» или «дд.мм.гггг». Без года — ближайшая не будущая дата (этот или прошлый год).
export function parseDayMonth(text: string, todayStr: string): DayMonthResult {
  const match = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/.exec(text.trim());
  if (!match) return { ok: false, error: DATE_EXAMPLE };

  const d = Number(match[1]);
  const m = Number(match[2]);
  const todayYear = Number(todayStr.slice(0, 4));
  let y = match[3] ? Number(match[3]) : todayYear;

  if (!match[3]) {
    const candidate = `${y}-${pad(m)}-${pad(d)}`;
    if (candidate > todayStr) y -= 1;
  }

  if (!isValidDate(y, m, d)) return { ok: false, error: `Такой даты нет. ${DATE_EXAMPLE}` };

  const dateStr = `${y}-${pad(m)}-${pad(d)}`;
  const back = daysBetween(dateStr, todayStr);
  if (back < 0) return { ok: false, error: 'Нельзя записать тренировку в будущее.' };
  if (back > MAX_DAYS_BACK) return { ok: false, error: 'Можно записать тренировку не старше года.' };

  return { ok: true, dateStr };
}
