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

  // Тонкая декоративная неоновая полоса сверху (PR оранжевый в токсичный лайм, без тила)
  const limeGrad = ctx.createLinearGradient(80, 0, width - 80, 0);
  limeGrad.addColorStop(0, '#ff7a1a');
  limeGrad.addColorStop(1, '#c9ff2e');
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

/**
 * Отрисовывает вертикальную неоновую карточку личного рекорда 1080x1920 (Canvas)
 * по правилам DESIGN.md:
 * - Цифры на Anton display.
 * - Текст на Barlow / Barlow Semi Condensed.
 * - Токсичный неоновый лайм #c9ff2e и PR-оранжевый #ff7a1a на спортзальном темном фоне #0e1117.
 */
export async function generatePrStoryCard(
  pr: ShareCardPr,
  dateStr: string,
  prev1RM?: number
): Promise<Blob> {
  const width = 1080;
  const height = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // 1. Темный спортзальный фон #0e1117
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#141922');
  bgGrad.addColorStop(0.45, '#0e1117');
  bgGrad.addColorStop(1, '#07090c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Неоновое лаймовое свечение в верхнем углу
  const aura = ctx.createRadialGradient(width * 0.82, 250, 40, width * 0.82, 250, 650);
  aura.addColorStop(0, 'rgba(201, 255, 46, 0.18)');
  aura.addColorStop(0.6, 'rgba(201, 255, 46, 0.03)');
  aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, height);

  // PR Flame оранжевое свечение снизу
  const flameAura = ctx.createRadialGradient(180, height - 350, 50, 180, height - 350, 600);
  flameAura.addColorStop(0, 'rgba(255, 122, 26, 0.16)');
  flameAura.addColorStop(0.65, 'rgba(255, 122, 26, 0.03)');
  flameAura.addColorStop(1, 'transparent');
  ctx.fillStyle = flameAura;
  ctx.fillRect(0, 0, width, height);

  // Верхняя неоновая полоса-акцент (PR оранжевый в токсичный лайм, строго без тила)
  const limeGrad = ctx.createLinearGradient(80, 0, width - 80, 0);
  limeGrad.addColorStop(0, '#ff7a1a');
  limeGrad.addColorStop(1, '#c9ff2e');
  ctx.fillStyle = limeGrad;
  ctx.fillRect(80, 80, width - 160, 6);

  // 2. Брендинг GYM95
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 68px "Anton", sans-serif';
  ctx.fillText('GYM95', 80, 190);

  // PR Бейдж
  ctx.fillStyle = 'rgba(255, 122, 26, 0.16)';
  ctx.strokeStyle = '#ff7a1a';
  ctx.lineWidth = 2;
  roundRect(ctx, 280, 142, 210, 42, 10, true, true);

  ctx.fillStyle = '#ff7a1a';
  ctx.font = '700 16px "Barlow Semi Condensed", -apple-system, sans-serif';
  ctx.fillText('🔥 NEW PR RECORD', 300, 169);

  // Дата
  ctx.fillStyle = '#8a8f98';
  ctx.font = '600 24px "Barlow Semi Condensed", -apple-system, sans-serif';
  ctx.fillText(dateStr.toUpperCase(), width - 80 - ctx.measureText(dateStr.toUpperCase()).width, 172);

  // 3. Основная карточка рекорда
  const cardY = 250;
  const cardH = 1480;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  roundRect(ctx, 80, cardY, width - 160, cardH, 24, true, true);

  // Название упражнения
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 48px "Barlow", -apple-system, sans-serif';
  const exName = pr.exercise.length > 28 ? pr.exercise.slice(0, 28) + '...' : pr.exercise;
  ctx.fillText(exName.toUpperCase(), 130, cardY + 120);

  // Большая карточка с весом
  const heroY = cardY + 180;
  ctx.fillStyle = 'rgba(201, 255, 46, 0.06)';
  ctx.strokeStyle = '#c9ff2e';
  ctx.lineWidth = 3;
  roundRect(ctx, 130, heroY, width - 260, 420, 20, true, true);

  ctx.fillStyle = '#c9ff2e';
  ctx.font = '700 24px "Barlow Semi Condensed", -apple-system, sans-serif';
  ctx.fillText('ВЕС НА СНАРЯДЕ', 170, heroY + 65);

  // Вес Anton для числа + Barlow для единиц измерения
  ctx.fillStyle = '#c9ff2e';
  ctx.font = '900 200px "Anton", sans-serif';
  ctx.fillText(`${pr.weight}`, 170, heroY + 270);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 64px "Barlow Semi Condensed", sans-serif';
  const weightTextWidth = ctx.measureText(`${pr.weight}`).width;
  ctx.fillText('КГ', 200 + weightTextWidth, heroY + 245);

  // Бейдж повторений
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  roundRect(ctx, 170, heroY + 320, 300, 56, 12, true, true);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 24px "Barlow Semi Condensed", -apple-system, sans-serif';
  ctx.fillText(`× ${pr.reps} ПОВТОРЕНИЙ`, 210, heroY + 358);

  // 4. Расчетный 1RM блок
  const oneRmY = heroY + 460;
  ctx.fillStyle = 'rgba(255, 122, 26, 0.08)';
  ctx.strokeStyle = '#ff7a1a';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 130, oneRmY, width - 260, 280, 20, true, true);

  ctx.fillStyle = '#ff7a1a';
  ctx.font = '700 22px "Barlow Semi Condensed", -apple-system, sans-serif';
  ctx.fillText('РАСЧЁТНЫЙ МАКСИМУМ 1RM (ЭПЛИ)', 170, oneRmY + 60);

  ctx.fillStyle = '#ff7a1a';
  ctx.font = '900 130px "Anton", sans-serif';
  ctx.fillText(`~${pr.oneRepMax}`, 170, oneRmY + 200);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 44px "Barlow Semi Condensed", sans-serif';
  const oneRmTextWidth = ctx.measureText(`~${pr.oneRepMax}`).width;
  ctx.fillText('КГ 1RM', 200 + oneRmTextWidth, oneRmY + 185);

  if (prev1RM) {
    ctx.fillStyle = '#8a8f98';
    ctx.font = '600 20px "Barlow", -apple-system, sans-serif';
    ctx.fillText(`Прошлый 1RM рекорд: ~${prev1RM} кг`, 170, oneRmY + 245);
  }

  // 5. Динамика прироста (если есть дельта)
  let footerY = oneRmY + 320;
  if (prev1RM && pr.oneRepMax > prev1RM) {
    const deltaKg = Math.round((pr.oneRepMax - prev1RM) * 10) / 10;
    const percent = Math.round((deltaKg / prev1RM) * 100);

    ctx.fillStyle = 'rgba(201, 255, 46, 0.12)';
    ctx.strokeStyle = '#c9ff2e';
    ctx.lineWidth = 2;
    roundRect(ctx, 130, footerY, width - 260, 160, 20, true, true);

    ctx.fillStyle = '#c9ff2e';
    ctx.font = '700 22px "Barlow Semi Condensed", -apple-system, sans-serif';
    ctx.fillText('ДИНАМИКА ПРИРОСТА К РЕКОРДУ', 170, footerY + 55);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px "Anton", sans-serif';
    const deltaText = `+${deltaKg}`;
    ctx.fillText(deltaText, 170, footerY + 120);
    const deltaWidth = ctx.measureText(deltaText).width;

    ctx.fillStyle = '#c9ff2e';
    ctx.font = '700 36px "Barlow Semi Condensed", sans-serif';
    ctx.fillText(' КГ', 170 + deltaWidth, footerY + 116);
    const kgWidth = ctx.measureText(' КГ').width;

    if (percent) {
      ctx.fillStyle = '#8a8f98';
      ctx.font = '600 32px "Barlow Semi Condensed", sans-serif';
      ctx.fillText(` (+${percent}%)`, 170 + deltaWidth + kgWidth, footerY + 116);
    }

    footerY += 200;
  }

  // 6. Подвал
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(130, cardY + cardH - 100, width - 260, 1);

  ctx.fillStyle = '#8a8f98';
  ctx.font = '700 20px "Barlow Semi Condensed", -apple-system, sans-serif';
  ctx.fillText('GYM95 · СИЛА В ДИСЦИПЛИНЕ', 130, cardY + cardH - 50);

  ctx.fillStyle = '#c9ff2e';
  ctx.font = '600 20px "Barlow", -apple-system, sans-serif';
  ctx.fillText('@gym95_bot', width - 260, cardY + cardH - 50);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create PR Blob from canvas'));
    }, 'image/png');
  });
}
