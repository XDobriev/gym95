// Генератор карточек Stories/Reels (1080x1920 Canvas) для Gym95

export interface ShareCardExercise {
  name: string;
  bestSet: { weight: number; reps: number };
  totalSets: number;
}

export interface ShareCardPr {
  exercise: string;
  weight: number;
  reps: number;
  oneRepMax: number;
}

export interface ShareCardData {
  dateStr: string;
  durationMinutes: number;
  totalVolumeKg: number;
  totalSets: number;
  exercises: ShareCardExercise[];
  newPrs?: ShareCardPr[];
}

/**
 * Отрисовывает брендовую вертикальную карточку тренировки 1080x1920 на HTML5 Canvas
 * и возвращает изображение в виде PNG Blob.
 */
export async function generateWorkoutShareCard(data: ShareCardData): Promise<Blob> {
  const width = 1080;
  const height = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // 1. Темный спортивный фон
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0d1015');
  bgGrad.addColorStop(0.5, '#080a0d');
  bgGrad.addColorStop(1, '#050608');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Неоновое свечение в углу (Lime aura)
  const aura = ctx.createRadialGradient(width * 0.85, 200, 50, width * 0.85, 200, 600);
  aura.addColorStop(0, 'rgba(201, 255, 46, 0.16)');
  aura.addColorStop(0.6, 'rgba(201, 255, 46, 0.04)');
  aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, height);

  // Оранжевое свечение снизу (PR flame aura)
  const flameAura = ctx.createRadialGradient(150, height - 300, 50, 150, height - 300, 550);
  flameAura.addColorStop(0, 'rgba(255, 122, 26, 0.12)');
  flameAura.addColorStop(0.7, 'rgba(255, 122, 26, 0.02)');
  flameAura.addColorStop(1, 'transparent');
  ctx.fillStyle = flameAura;
  ctx.fillRect(0, 0, width, height);

  // Тонкая декоративная неоновая полоса сверху
  const limeGrad = ctx.createLinearGradient(80, 0, width - 80, 0);
  limeGrad.addColorStop(0, '#c9ff2e');
  limeGrad.addColorStop(0.5, '#00e0a4');
  limeGrad.addColorStop(1, '#ff7a1a');
  ctx.fillStyle = limeGrad;
  ctx.fillRect(80, 90, width - 160, 6);

  // 2. Брендинг GYM95
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 68px "Anton", sans-serif, -apple-system';
  ctx.fillText('GYM95', 80, 200);

  ctx.fillStyle = '#c9ff2e';
  ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
  ctx.fillText('LIVE WORKOUT', 290, 175);

  ctx.fillStyle = '#8a8f98';
  ctx.font = '500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
  ctx.fillText(data.dateStr, 290, 210);

  // 3. Большие карточки с ключевыми метриками (3 колонки)
  const metricsY = 270;
  const colWidth = (width - 160 - 40) / 3;

  const metrics = [
    { label: 'ТОННАЖ', val: `${data.totalVolumeKg.toLocaleString('ru-RU')} КГ`, color: '#c9ff2e' },
    { label: 'ВРЕМЯ', val: `${data.durationMinutes} МИН`, color: '#ffffff' },
    { label: 'ПОДХОДОВ', val: `${data.totalSets}`, color: '#00e0a4' },
  ];

  metrics.forEach((m, idx) => {
    const cardX = 80 + idx * (colWidth + 20);

    // Карточка подложки
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, metricsY, colWidth, 160, 20, true, true);

    // Лейбл метрики
    ctx.fillStyle = '#8a8f98';
    ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillText(m.label, cardX + 24, metricsY + 48);

    // Значение Anton
    ctx.fillStyle = m.color;
    ctx.font = '900 48px "Anton", sans-serif, -apple-system';
    ctx.fillText(m.val, cardX + 24, metricsY + 118);
  });

  let currentY = metricsY + 220;

  // 4. Блок новых рекордов (если есть)
  if (data.newPrs && data.newPrs.length > 0) {
    ctx.fillStyle = 'rgba(255, 122, 26, 0.12)';
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 3;
    const prBoxHeight = 80 + data.newPrs.length * 56;
    roundRect(ctx, 80, currentY, width - 160, prBoxHeight, 20, true, true);

    ctx.fillStyle = '#ff7a1a';
    ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillText('🔥 НОВЫЕ ЛИЧНЫЕ РЕКОРДЫ (PR):', 110, currentY + 48);

    data.newPrs.forEach((pr, i) => {
      const itemY = currentY + 95 + i * 54;
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
      ctx.fillText(`• ${pr.exercise}:`, 120, itemY);

      ctx.fillStyle = '#ff7a1a';
      ctx.font = '900 28px "Anton", sans-serif';
      const prText = `${pr.weight} кг × ${pr.reps} (1RM ~${pr.oneRepMax} кг)`;
      ctx.fillText(prText, 450, itemY);
    });

    currentY += prBoxHeight + 40;
  }

  // 5. Список упражнений тренировки
  ctx.fillStyle = '#8a8f98';
  ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
  ctx.fillText('УПРАЖНЕНИЯ СЕССИИ:', 80, currentY);
  currentY += 24;

  const maxExToShow = 7;
  const exList = data.exercises.slice(0, maxExToShow);

  exList.forEach((ex) => {
    currentY += 20;

    // Плашка упражнения
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 80, currentY, width - 160, 94, 16, true, true);

    // Название упражнения
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    const exName = ex.name.length > 30 ? ex.name.slice(0, 30) + '...' : ex.name;
    ctx.fillText(exName, 110, currentY + 42);

    // Подходы
    ctx.fillStyle = '#8a8f98';
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillText(`${ex.totalSets} подходов`, 110, currentY + 74);

    // Лучший подход (весовой акцент)
    if (ex.bestSet.weight > 0) {
      ctx.fillStyle = '#c9ff2e';
      ctx.font = '900 32px "Anton", sans-serif';
      const bestText = `${ex.bestSet.weight} кг × ${ex.bestSet.reps}`;
      const textWidth = ctx.measureText(bestText).width;
      ctx.fillText(bestText, width - 120 - textWidth, currentY + 58);
    }

    currentY += 94;
  });

  if (data.exercises.length > maxExToShow) {
    currentY += 20;
    ctx.fillStyle = '#8a8f98';
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillText(`+ ещё ${data.exercises.length - maxExToShow} упр.`, 110, currentY + 20);
  }

  // 6. Подвал (Footer)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(80, height - 160, width - 160, 1);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
  ctx.fillText('gym95', 80, height - 105);

  ctx.fillStyle = '#8a8f98';
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
  ctx.fillText('Дневник силовых тренировок в Telegram', 170, height - 105);

  // Возвращаем Blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create Blob from canvas'));
    }, 'image/png');
  });
}

/**
 * Вспомогательная функция рисования скругленного прямоугольника на Canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill = false,
  stroke = false
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

/**
 * Инициирует шаринг изображения (Stories / соцсети) или скачивание.
 */
export async function shareOrDownloadWorkoutCard(blob: Blob, fileName = 'gym95-workout.png'): Promise<boolean> {
  const file = new File([blob], fileName, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Тренировка в Gym95',
        text: 'Мой результат тренировки в Gym95 💪',
        files: [file],
      });
      return true;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Share API error, fallback to download:', err);
      } else {
        return false;
      }
    }
  }

  // Фолбэк на скачивание
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Формирует красивый текст тренировки для копирования в буфер обмена.
 */
export function formatWorkoutSummaryText(data: ShareCardData): string {
  const lines: string[] = [
    `⚡ Тренировка GYM95 (${data.dateStr})`,
    `⏱ Длительность: ${data.durationMinutes} мин`,
    `🏋️‍♂️ Тоннаж: ${data.totalVolumeKg.toLocaleString('ru-RU')} кг | Подходов: ${data.totalSets}`,
    '',
  ];

  if (data.newPrs && data.newPrs.length > 0) {
    lines.push('🔥 Новые личные рекорды (PR):');
    data.newPrs.forEach((pr) => {
      lines.push(`• ${pr.exercise}: ${pr.weight} кг × ${pr.reps} (1RM ~${pr.oneRepMax} кг)`);
    });
    lines.push('');
  }

  lines.push('📋 Упражнения:');
  data.exercises.forEach((ex, idx) => {
    const best = ex.bestSet.weight > 0 ? ` [лучший: ${ex.bestSet.weight} кг × ${ex.bestSet.reps}]` : '';
    lines.push(`${idx + 1}. ${ex.name} — ${ex.totalSets} подх.${best}`);
  });

  lines.push('');
  lines.push('💪 Записано через @gym95bot');
  return lines.join('\n');
}
