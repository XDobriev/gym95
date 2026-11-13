import { estimateFoodFromImage, Estimate, parseEstimate, FoodItemBreakdown } from './foodEstimate';

export interface FormatFoodCardOptions {
  dateStr?: string;
  todayStr?: string;
}

/**
 * Форматирует карточку оценки блюда с детальным КБЖУ и составом по граммам.
 */
export function formatFoodCard(
  est: Extract<Estimate, { isFood: true }>,
  options: FormatFoodCardOptions = {}
): string {
  const lines: string[] = [];

  // Заголовок: название и вес порции
  let portionClean = est.portion?.trim();
  if (portionClean && portionClean.startsWith('(') && portionClean.endsWith(')')) {
    portionClean = portionClean.slice(1, -1).trim();
  }
  const portionSuffix = portionClean ? ` (${portionClean})` : '';
  lines.push(`🍽 <b>${escapeHtml(est.name)}${escapeHtml(portionSuffix)}</b>`);

  // Состав блюда по элементам (если распознаны отдельные компоненты)
  if (est.items && est.items.length > 0) {
    lines.push('');
    lines.push('<b>Состав тарелки:</b>');
    for (const item of est.items) {
      let itemPortionClean = item.portion?.trim();
      if (itemPortionClean && itemPortionClean.startsWith('(') && itemPortionClean.endsWith(')')) {
        itemPortionClean = itemPortionClean.slice(1, -1).trim();
      }
      if (itemPortionClean && itemPortionClean.startsWith('~')) {
        itemPortionClean = itemPortionClean.slice(1).trim();
      }
      const p = itemPortionClean ? ` (~${itemPortionClean})` : '';
      const macroParts: string[] = [];
      if (item.proteinG !== null && item.proteinG !== undefined) macroParts.push(`Б: ${item.proteinG}г`);
      if (item.fatG !== null && item.fatG !== undefined) macroParts.push(`Ж: ${item.fatG}г`);
      if (item.carbsG !== null && item.carbsG !== undefined) macroParts.push(`У: ${item.carbsG}г`);
      const macroStr = macroParts.length > 0 ? ` · ${macroParts.join(' | ')}` : '';
      lines.push(`• ${escapeHtml(item.name)}${escapeHtml(p)} — ${item.kcal} ккал${macroStr}`);
    }
  }

  // Суммарные калории и КБЖУ
  lines.push('');
  lines.push(`🔥 <b>Итого: ≈ ${est.kcal} ккал</b>`);

  const macros: string[] = [];
  if (est.proteinG !== null && est.proteinG !== undefined) macros.push(`Б ${est.proteinG}г`);
  if (est.fatG !== null && est.fatG !== undefined) macros.push(`Ж ${est.fatG}г`);
  if (est.carbsG !== null && est.carbsG !== undefined) macros.push(`У ${est.carbsG}г`);

  if (macros.length > 0) {
    lines.push(`📊 <b>КБЖУ:</b> ${macros.join(' · ')}`);
  }

  if (options.dateStr && options.todayStr && options.dateStr !== options.todayStr) {
    const ddmm = `${options.dateStr.slice(8)}.${options.dateStr.slice(5, 7)}`;
    lines.push(`📅 Запишу за ${ddmm}.`);
  }

  lines.push('');
  lines.push('<i>Оценка по фото (погрешность 15–25%). Знаешь точнее — нажми «Своё число».</i>');

  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Обрабатывает изображение (Buffer или base64 string) через Gemini Multimodal.
 */
export async function analyzeFoodPhoto(
  image: Buffer | string,
  mimeType: string = 'image/jpeg',
  caption?: string
): Promise<Estimate> {
  const base64 = typeof image === 'string' ? image : image.toString('base64');
  return await estimateFoodFromImage(base64, mimeType, caption);
}

export { parseEstimate as parseEstimateJson, Estimate, FoodItemBreakdown };
