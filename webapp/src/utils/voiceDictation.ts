// Распознавание голоса и парсинг подходов для Gym95 Live Workout

export interface ParsedVoiceSet {
  weight: number;
  reps: number;
  raw: string;
}

/**
 * Нормализует речевой ввод на русском:
 * Заменяет словесные обороты "с половиной", знаки умножения и т.п. на цифры.
 */
export function normalizeVoiceText(text: string): string {
  let res = text.toLowerCase().trim();

  // "82 с половиной" -> "82.5"
  res = res.replace(/(\d+)\s+(?:с\s+половиной|и\s+половина)/gi, '$1.5');
  // "82 запятая 5" / "82 точка 5"
  res = res.replace(/(\d+)\s+(?:запятая|точка)\s+(\d+)/gi, '$1.$2');

  // Замена некоторых словесных числительных
  const wordNumbers: Record<string, string> = {
    'ноль': '0',
    'один': '1',
    'раз': '1',
    'два': '2',
    'раза': '2',
    'три': '3',
    'четыре': '4',
    'пять': '5',
    'шесть': '6',
    'семь': '7',
    'восемь': '8',
    'девять': '9',
    'десять': '10',
    'одиннадцать': '11',
    'двенадцать': '12',
    'пятнадцать': '15',
    'двадцать': '20',
  };

  for (const [word, num] of Object.entries(wordNumbers)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    res = res.replace(regex, num);
  }

  return res;
}

/**
 * Извлекает вес и количество повторений из распознанного текста.
 * Поддерживаемые паттерны:
 * - "85 на 8"
 * - "85 по 8"
 * - "85 x 8", "85*8"
 * - "85 кг 8 повторений"
 * - "85 8" (два числа подряд)
 */
export function parseVoiceWorkoutSet(transcript: string): ParsedVoiceSet | null {
  if (!transcript || typeof transcript !== 'string') return null;

  const normalized = normalizeVoiceText(transcript);

  // Паттерн 1: с разделителем (на, по, x, х, *, кг)
  // пример: "85 на 8", "85.5 по 10", "100кг 5", "100 x 6"
  const patternWithSeparator =
    /(?:^|[^\d.])(\d+(?:[.,]\d+)?)\s*(?:кг|кэгэ|килограмм|килограмма|килограммов)?\s*(?:на|по|[xх*]|в|за)\s*(\d+)\s*(?:раз|раза|повторений|повтора|повт)?(?=[^\d.]|$)/i;

  const match1 = normalized.match(patternWithSeparator);
  if (match1) {
    const weight = parseFloat(match1[1].replace(',', '.'));
    const reps = parseInt(match1[2], 10);
    if (!isNaN(weight) && !isNaN(reps) && reps > 0) {
      return { weight, reps, raw: transcript };
    }
  }

  // Паттерн 2: два числа подряд через пробел или "кг"
  // пример: "85 кг 8", "100 8", "60 12"
  const patternTwoNumbers =
    /(?:^|[^\d.])(\d+(?:[.,]\d+)?)\s*(?:кг|кэгэ|килограмм)?\s+(\d+)\s*(?:раз|раза|повторений|повтора)?(?=[^\d.]|$)/i;

  const match2 = normalized.match(patternTwoNumbers);
  if (match2) {
    const weight = parseFloat(match2[1].replace(',', '.'));
    const reps = parseInt(match2[2], 10);
    if (!isNaN(weight) && !isNaN(reps) && reps > 0) {
      return { weight, reps, raw: transcript };
    }
  }

  return null;
}

/**
 * Проверяет, доступен ли Web Speech API в текущем браузере.
 */
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

// Тип для SpeechRecognition
type SpeechRecognitionType = any;

/**
 * Создает и настраивает экземпляр распознавателя речи.
 */
export function createSpeechRecognizer(
  onResult: (text: string, parsed: ParsedVoiceSet | null) => void,
  onError?: (err: string) => void,
  onEnd?: () => void
): { start: () => void; stop: () => void } | null {
  if (!isSpeechRecognitionSupported()) return null;

  const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition: SpeechRecognitionType = new SpeechClass();

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'ru-RU';

  recognition.onresult = (event: any) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    const parsed = parseVoiceWorkoutSet(transcript);
    onResult(transcript, parsed);
  };

  recognition.onerror = (event: any) => {
    if (onError) onError(event.error || 'Ошибка распознавания');
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch (err) {
        console.warn('SpeechRecognition start error:', err);
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch (err) {
        console.warn('SpeechRecognition stop error:', err);
      }
    },
  };
}
