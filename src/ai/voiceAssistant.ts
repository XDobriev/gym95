import { isAiConfigured } from './foodEstimate';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-lite-latest',
];
const TIMEOUT_MS = 25_000;

export type VoiceAction =
  | { action: 'water'; ml: number; transcript: string }
  | { action: 'weight'; kg: number; transcript: string }
  | { action: 'sleep'; hours: number; transcript: string }
  | {
      action: 'food';
      description: string;
      meal?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      kcal: number | null;
      transcript: string;
    }
  | {
      action: 'cardio';
      activity: 'walking' | 'running' | 'treadmill' | 'bike' | 'pool';
      laps?: number;
      distanceKm?: number;
      durationMinutes?: number;
      transcript: string;
    }
  | {
      action: 'workout';
      durationMinutes?: number;
      exercises: { name: string; sets: { weight: number; reps: number }[] }[];
      transcript: string;
    }
  | {
      action: 'sets';
      sets: { weight: number; reps: number }[];
      transcript: string;
    }
  | { action: 'unknown'; transcript: string };

const VOICE_PROMPT = `Ты — голосовой ассистент фитнес-бота gym95.
Твоя задача — транскрибировать голосовое сообщение пользователя на русском языке и извлечь структурированное действие.

Возможные типы действий (action):
1. "water": запись выпитой воды
   {"action": "water", "ml": число_мл, "transcript": "текст"} (стакан = 250 мл, кружка/бутылка 500 мл если число не названо)
2. "weight": запись веса тела
   {"action": "weight", "kg": число_кг, "transcript": "текст"}
3. "sleep": запись продолжительности сна
   {"action": "sleep", "hours": число_часов, "transcript": "текст"}
4. "food": запись приёма пищи
   {"action": "food", "description": "название блюда/еды", "meal": "breakfast"|"lunch"|"dinner"|"snack"|null, "kcal": число_ккал_или_null, "transcript": "текст"}
5. "cardio": кардио, бег, ходьба или круги на стадионе
   {"action": "cardio", "activity": "walking"|"running"|"treadmill"|"bike"|"pool", "laps": число_кругов_если_названы, "distanceKm": число_км, "durationMinutes": число_минут, "transcript": "текст"}
   Если названы только круги стадиона (например "намотал 10 кругов"), 1 круг = 0.4 км.
6. "workout": полная силовая тренировка со списком упражнений и подходов
   {"action": "workout", "durationMinutes": число_минут_или_null, "exercises": [{"name": "название упражнения", "sets": [{"weight": число_кг_или_0, "reps": число_повторений}]}], "transcript": "текст"}
7. "sets": если надиктованы только подходы к текущему упражнению (например "80 на 10, два подхода по 85 на 8" или "три подхода по 12 подтягиваний")
   {"action": "sets", "sets": [{"weight": число_кг_или_0, "reps": число_повторений}], "transcript": "текст"}
8. "unknown": если сказанное не относится к фитнес-действию
   {"action": "unknown", "transcript": "распознанный текст"}

Отвечай СТРОГО одним валидным JSON без разметки markdown и пояснений.`;

function models(): string[] {
  const custom = process.env.GEMINI_MODEL?.trim();
  return custom ? [custom, ...FALLBACK_MODELS.filter((m) => m !== custom)] : FALLBACK_MODELS;
}

export function parseVoiceActionJson(text: string): VoiceAction | null {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned) as VoiceAction;
    if (parsed && typeof parsed.action === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function parseVoiceAction(audioBase64: string, mimeType = 'audio/ogg'): Promise<VoiceAction> {
  if (!isAiConfigured()) {
    throw new Error('Gemini API ключ не настроен');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (const model of models()) {
      try {
        const res = await fetch(`${API_BASE}/${model}:generateContent`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: VOICE_PROMPT }] },
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType, data: audioBase64 } },
                  { text: 'Распознай аудио и верни JSON действия.' },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });

        if (!res.ok) continue;

        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        const parsed = parseVoiceActionJson(rawText);
        if (parsed) {
          return parsed;
        }
      } catch (err) {
        console.warn(`Ошибка Gemini модели ${model} при обработке голоса:`, err);
      }
    }
    return { action: 'unknown', transcript: 'Не удалось распознать речь' };
  } finally {
    clearTimeout(timer);
  }
}
