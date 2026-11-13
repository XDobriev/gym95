// Оценка калорийности по описанию через Gemini API (бесплатный тариф AI Studio).
// Ключ — GEMINI_API_KEY; без него функция недоступна (isAiConfigured() === false).
// Модель — GEMINI_MODEL или список запасных: имена моделей у Google часто меняются,
// поэтому при 404 пробуем следующую.

export interface FoodItemBreakdown {
  name: string;
  portion: string;
  kcal: number;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
}

export type Estimate =
  | {
      isFood: true;
      name: string;
      portion: string | null;
      kcal: number;
      proteinG: number | null;
      fatG?: number | null;
      carbsG?: number | null;
      items?: FoodItemBreakdown[];
    }
  | { isFood: false };

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];
const TIMEOUT_MS = 30_000;

export const SYSTEM_PROMPT = `Ты эксперт-диетолог и оцениваешь калорийность и КБЖУ еды по короткому описанию или фото на русском языке.
Если размер порции не указан — бери типичную домашнюю порцию для взрослого.
Определи состав блюд, примерный вес/размер порции, суммарную калорийность и БЖУ (белки, жиры, углеводы в граммах).
Отвечай ТОЛЬКО JSON без markdown и без пояснений:
{
  "isFood": true,
  "name": "краткое название блюда или тарелки",
  "portion": "порция с примерным весом, например «тарелка ~400 г»",
  "kcal": 550,
  "proteinG": 35,
  "fatG": 14,
  "carbsG": 65,
  "items": [
    {"name": "куриное филе", "portion": "150 г", "kcal": 240, "proteinG": 31, "fatG": 4, "carbsG": 0},
    {"name": "гречка отварная", "portion": "200 г", "kcal": 220, "proteinG": 8, "fatG": 2, "carbsG": 42}
  ]
}
Если текст или фото не про еду или напитки — {"isFood": false}.`;

export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function models(): string[] {
  const custom = process.env.GEMINI_MODEL?.trim();
  return custom ? [custom, ...FALLBACK_MODELS.filter((m) => m !== custom)] : FALLBACK_MODELS;
}

// Разбор и проверка ответа модели. null — ответ непригоден (не JSON, ккал вне 20–5000).
export function parseEstimate(raw: string): Estimate | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (obj.isFood === false) return { isFood: false };
  if (obj.isFood !== true) return null;

  const kcal = Math.round(Number(obj.kcal));
  if (!Number.isFinite(kcal) || kcal < 20 || kcal > 5000) return null;
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 100) : null;
  if (!name) return null;
  const portion = typeof obj.portion === 'string' && obj.portion.trim() ? obj.portion.trim().slice(0, 100) : null;

  const parseNumOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const proteinG = parseNumOrNull(obj.proteinG ?? (obj as any).protein ?? (obj as any).proteins);
  const fatG = parseNumOrNull(obj.fatG ?? (obj as any).fat ?? (obj as any).fats);
  const carbsG = parseNumOrNull(obj.carbsG ?? (obj as any).carbs ?? (obj as any).carbohydrates);

  let items: FoodItemBreakdown[] | undefined;
  if (Array.isArray(obj.items)) {
    const rawList: (FoodItemBreakdown | null)[] = obj.items.map((it: any): FoodItemBreakdown | null => {
      if (!it || typeof it !== 'object') return null;
      const itemName = typeof it.name === 'string' && it.name.trim() ? it.name.trim().slice(0, 80) : '';
      if (!itemName) return null;
      const itemPortion = typeof it.portion === 'string' && it.portion.trim() ? it.portion.trim().slice(0, 80) : '';
      const itemKcal = Math.round(Number(it.kcal));
      return {
        name: itemName,
        portion: itemPortion,
        kcal: Number.isFinite(itemKcal) && itemKcal >= 0 ? itemKcal : 0,
        proteinG: parseNumOrNull(it.proteinG ?? it.protein),
        fatG: parseNumOrNull(it.fatG ?? it.fat),
        carbsG: parseNumOrNull(it.carbsG ?? it.carbs),
      };
    });
    const valid = rawList.filter((it): it is FoodItemBreakdown => it !== null);
    if (valid.length > 0) items = valid;
  }

  const result: Extract<Estimate, { isFood: true }> = {
    isFood: true,
    name,
    portion,
    kcal,
    proteinG,
  };

  if ('fatG' in obj || 'fat' in obj || 'fats' in obj) {
    result.fatG = fatG;
  }
  if ('carbsG' in obj || 'carbs' in obj || 'carbohydrates' in obj) {
    result.carbsG = carbsG;
  }
  if (items && items.length > 0) {
    result.items = items;
  }

  return result;
}

export class AiError extends Error {
  constructor(message: string, public readonly kind: 'quota' | 'unavailable') {
    super(message);
    this.name = 'AiError';
  }
}

async function callModel(model: string, description: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const key = (process.env.GEMINI_API_KEY ?? '').trim();
    return await fetch(`${API_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: description }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function estimateFood(description: string): Promise<Estimate> {
  let lastStatus = 0;
  for (const model of models()) {
    let res: Response;
    try {
      res = await callModel(model, description);
    } catch (err) {
      throw new AiError(`Gemini недоступен: ${err instanceof Error ? err.message : err}`, 'unavailable');
    }
    lastStatus = res.status;
    if (res.status === 400 || res.status === 403) {
      const body = await res.text().catch(() => '');
      if (/api[ _]?key/i.test(body)) throw new AiError('Ключ Gemini недействителен или без доступа', 'unavailable');
      continue; // модель не поддерживает параметры запроса — пробуем следующую
    }
    if (res.status === 404 || res.status === 429 || res.status === 500 || res.status === 503) {
      continue; // перегрузка или лимит на этой модели — пробуем следующую
    }
    if (!res.ok) continue;

    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const parsed = parseEstimate(text);
    if (!parsed) throw new AiError('Непонятный ответ модели', 'unavailable');
    return parsed;
  }
  throw new AiError(`Ни одна модель Gemini не подошла (последний ответ ${lastStatus})`, 'unavailable');
}

async function callModelWithImage(
  model: string,
  base64: string,
  mimeType: string,
  caption?: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const key = (process.env.GEMINI_API_KEY ?? '').trim();
    return await fetch(`${API_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              {
                text: caption
                  ? `Оцени блюдо на фото с учётом пояснения: ${caption}`
                  : 'Оцени калорийность и состав блюда на фото.',
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function estimateFoodFromImage(
  base64: string,
  mimeType = 'image/jpeg',
  caption?: string
): Promise<Estimate> {
  let lastStatus = 0;
  for (const model of models()) {
    let res: Response;
    try {
      res = await callModelWithImage(model, base64, mimeType, caption);
    } catch (err) {
      throw new AiError(`Gemini недоступен: ${err instanceof Error ? err.message : err}`, 'unavailable');
    }
    lastStatus = res.status;
    if (res.status === 400 || res.status === 403) {
      const body = await res.text().catch(() => '');
      if (/api[ _]?key/i.test(body)) throw new AiError('Ключ Gemini недействителен или без доступа', 'unavailable');
      continue;
    }
    if (res.status === 404 || res.status === 429 || res.status === 500 || res.status === 503) {
      continue;
    }
    if (!res.ok) continue;

    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const parsed = parseEstimate(text);
    if (!parsed) throw new AiError('Непонятный ответ модели', 'unavailable');
    return parsed;
  }
  throw new AiError(`Ни одна модель Gemini не подошла (последний ответ ${lastStatus})`, 'unavailable');
}
