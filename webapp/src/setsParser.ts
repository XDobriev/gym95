// Зеркало src/utils/setsParser.ts бота — та же грамматика подходов, для
// живого превью в форме редактирования. webapp самодостаточен и не
// импортирует из ../src (см. webapp/shared/types.ts).

export interface ParsedSet {
  weight: number;
  reps: number;
}

export type ParseResult = { ok: true; sets: ParsedSet[] } | { ok: false; error: string };

const MAX_SETS_PER_LINE = 20;

// "40x12" / "42.5x10" / "12" (вес опционален — для упражнений с собственным весом)
const SET_TOKEN_RE = /^(?:(\d+(?:[.,]\d+)?)\s*[xXхХ*]\s*)?(\d+)$/;

export function parseSetsLine(input: string): ParseResult {
  const tokens = input
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return {
      ok: false,
      error: 'Не вижу ни одного подхода. Формат: вес x повторы, например 40x12, 40x12, 42.5x10',
    };
  }

  if (tokens.length > MAX_SETS_PER_LINE) {
    return {
      ok: false,
      error: `Слишком много подходов за раз (${tokens.length}). Максимум ${MAX_SETS_PER_LINE} — введи двумя сообщениями.`,
    };
  }

  const sets: ParsedSet[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const match = SET_TOKEN_RE.exec(token);

    if (!match) {
      return {
        ok: false,
        error: `Не понял подход №${i + 1}: "${token}". Формат: вес x повторы, например 40x12, 40x12, 42.5x10`,
      };
    }

    const weightRaw = match[1];
    const repsRaw = match[2];

    const weight = weightRaw ? parseFloat(weightRaw.replace(',', '.')) : 0;
    const reps = parseInt(repsRaw, 10);

    if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) {
      return {
        ok: false,
        error: `Не понял подход №${i + 1}: "${token}". Формат: вес x повторы, например 40x12, 40x12, 42.5x10`,
      };
    }

    sets.push({ weight, reps });
  }

  return { ok: true, sets };
}
