// Оценка калорийности по описанию через Gemini API (бесплатный тариф AI Studio).
// Ключ — GEMINI_API_KEY; без него функция недоступна (isAiConfigured() === false).
// Модель — GEMINI_MODEL или список запасных: имена моделей у Google часто меняются,
// поэтому при 404 пробуем следующую.

export type Estimate =
  | { isFood: true; name: string; portion: string | null; kcal: number; proteinG: number | null }
  | { isFood: false };

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `Ты оцениваешь калорийность еды по короткому описанию на русском языке.
Если размер порции не указан — бери типичную домашнюю порцию для взрослого.
Отвечай ТОЛЬКО JSON без пояснений:
{"isFood": true, "name": "краткое название блюда", "portion": "порция с примерным весом, например «тарелка ~350 г»", "kcal": целое число, "proteinG": целое число грамм белка}
Если текст не про еду или напитки — {"isFood": false}.`;

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
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 80) : null;
  if (!name) return null;
  const portion = typeof obj.portion === 'string' && obj.portion.trim() ? obj.portion.trim().slice(0, 80) : null;
  const protein = Math.round(Number(obj.proteinG));
  return { isFood: true, name, portion, kcal, proteinG: Number.isFinite(protein) && protein >= 0 ? protein : null };
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
