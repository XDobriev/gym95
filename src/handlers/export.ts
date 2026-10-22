import { Telegraf } from 'telegraf';
import { getAllWorkoutsForExport } from '../db/workouts';
import { getExercisesForWorkouts } from '../db/exercises';
import { getCardioSessionsForWorkouts, getCardioHistory } from '../db/cardio';
import { getWeightsSince, getLatestWeight, getUserTimezone } from '../db/profiles';
import { getLastMeasurements, MeasurementRow } from '../db/measure';
import { CardioSession, Exercise, Workout } from '../types/domain';
import { formatCardioInline, formatDateIsoDay, formatSetsInline, formatWorkoutTypeRu } from '../utils/format';
import { localNow, addDays } from '../utils/time';
import { computeChain } from '../utils/chain';

const TELEGRAM_MESSAGE_LIMIT = 4096;

function buildExportMarkdown(workouts: Workout[], exercises: Exercise[], cardioSessions: CardioSession[]): string {
  const exercisesByWorkout = new Map<string, Exercise[]>();
  for (const exercise of exercises) {
    const list = exercisesByWorkout.get(exercise.workout_id) ?? [];
    list.push(exercise);
    exercisesByWorkout.set(exercise.workout_id, list);
  }

  const cardioByWorkout = new Map(cardioSessions.map((c) => [c.workout_id, c]));

  const sections = workouts.map((workout) => {
    const durationSuffix = workout.duration_minutes ? ` (${workout.duration_minutes} мин)` : '';
    const header = `## ${formatDateIsoDay(workout.date)} — ${formatWorkoutTypeRu(workout.type)}${durationSuffix}`;

    const lines = (exercisesByWorkout.get(workout.id) ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => `- ${ex.name}: ${formatSetsInline(ex.sets)}`);

    if (workout.warmup_minutes) {
      lines.unshift(`- 🔥 Разминка: ${workout.warmup_minutes} мин`);
    }

    const cardio = cardioByWorkout.get(workout.id);
    if (cardio) {
      const cardioLine = formatCardioInline({
        activity: cardio.activity,
        durationMinutes: workout.duration_minutes,
        distanceKm: cardio.distance_km,
        avgHeartRate: cardio.avg_heart_rate,
        inclinePercent: cardio.incline_percent,
      })
        .split('\n')
        .join(', ');
      lines.push(`- ${cardioLine}`);
    }

    const body = lines.length > 0 ? lines.join('\n') : '- (без данных)';

    return `${header}\n${body}`;
  });

  return ['# Дневник тренировок gym95', '', ...sections].join('\n\n');
}

function buildHtmlReport(params: {
  dateStr: string;
  workoutsCount: number;
  streakDays: number;
  startWeight: number | null;
  currentWeight: number | null;
  cardioKm: number;
  cardioMinutes: number;
  measurements: MeasurementRow | null;
  markdownContent: string;
}): string {
  const deltaWeight =
    params.startWeight && params.currentWeight
      ? (params.currentWeight - params.startWeight).toFixed(1)
      : null;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>gym95 — Отчет о тренировках (${params.dateStr})</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1115; color: #e6edf3; padding: 30px; margin: 0; line-height: 1.6; }
  .container { max-width: 800px; margin: 0 auto; background: #161b22; border-radius: 16px; padding: 32px; border: 1px solid #30363d; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
  h1 { color: #c9ff2e; margin: 0 0 8px; font-size: 28px; letter-spacing: -0.5px; }
  .subtitle { color: #8b949e; font-size: 14px; margin-bottom: 24px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .stat-card { background: #21262d; border-radius: 12px; padding: 16px; border: 1px solid #30363d; }
  .stat-card .label { font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-card .value { font-size: 24px; font-weight: bold; color: #c9ff2e; margin-top: 4px; }
  h2 { color: #58a6ff; font-size: 20px; border-bottom: 1px solid #30363d; padding-bottom: 8px; margin-top: 32px; }
  pre { background: #0d1117; padding: 16px; border-radius: 10px; overflow-x: auto; color: #c9d1d9; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
  .footer { margin-top: 32px; text-align: center; color: #6e7681; font-size: 12px; }
</style>
</head>
<body>
<div class="container">
  <h1>gym95 · Персональный отчёт</h1>
  <div class="subtitle">Сформирован: ${params.dateStr}</div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="label">Тренировок</div>
      <div class="value">${params.workoutsCount}</div>
    </div>
    <div class="stat-card">
      <div class="label">Цепочка (Стрик)</div>
      <div class="value">${params.streakDays} дн</div>
    </div>
    <div class="stat-card">
      <div class="label">Кардио / Стадион</div>
      <div class="value">${params.cardioKm} км</div>
    </div>
    <div class="stat-card">
      <div class="label">Динамика веса</div>
      <div class="value">${params.currentWeight ? `${params.currentWeight} кг` : '—'} ${deltaWeight ? `(${Number(deltaWeight) > 0 ? `+${deltaWeight}` : deltaWeight} кг)` : ''}</div>
    </div>
  </div>

  <h2>Подробный журнал активности</h2>
  <pre>${params.markdownContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>

  <div class="footer">gym95 — твой персональный фитнес-дневник</div>
</div>
</body>
</html>`;
}

export function registerExport(bot: Telegraf): void {
  bot.command('export', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const workouts = await getAllWorkoutsForExport(userId);

    if (workouts.length === 0) {
      await ctx.reply('📭 Пока нет тренировок для экспорта. Начни с /new_workout');
      return;
    }

    const workoutIds = workouts.map((w) => w.id);
    const [exercises, cardioSessions] = await Promise.all([
      getExercisesForWorkouts(workoutIds),
      getCardioSessionsForWorkouts(workoutIds),
    ]);
    const markdown = buildExportMarkdown(workouts, exercises, cardioSessions);

    if (markdown.length <= TELEGRAM_MESSAGE_LIMIT) {
      await ctx.reply(markdown);
    } else {
      const filename = `gym95-export-${new Date().toISOString().slice(0, 10)}.md`;
      await ctx.replyWithDocument({ source: Buffer.from(markdown, 'utf-8'), filename });
    }
  });

  bot.command('report', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const progressMsg = await ctx.reply('📊 Формирую отчет...');

    try {
      const tz = await getUserTimezone(userId);
      const today = localNow(tz).dateStr;
      const oneYearAgo = addDays(today, -365);

      const [workouts, cardioList, weights, latestWeight, measurements] = await Promise.all([
        getAllWorkoutsForExport(userId).catch(() => [] as Workout[]),
        getCardioHistory(userId).catch(() => []),
        getWeightsSince(userId, oneYearAgo).catch(() => []),
        getLatestWeight(userId).catch(() => null),
        getLastMeasurements(userId).catch(() => null),
      ]);

      const chain = computeChain(
        workouts.map((w: Workout) => w.date.slice(0, 10)),
        today,
        2
      );

      let totalCardioKm = 0;
      let totalCardioMin = 0;
      for (const c of cardioList) {
        if (c.distanceKm) totalCardioKm += c.distanceKm;
      }
      for (const w of workouts) {
        if (w.duration_minutes) totalCardioMin += w.duration_minutes;
      }

      const startWeight = weights.length > 0 ? weights[0].kg : latestWeight;
      const currentWeight = latestWeight;

      const workoutIds = workouts.map((w: Workout) => w.id);
      const [exercises, cardioSessions] = await Promise.all([
        getExercisesForWorkouts(workoutIds),
        getCardioSessionsForWorkouts(workoutIds),
      ]);
      const markdown = buildExportMarkdown(workouts, exercises, cardioSessions);

      const html = buildHtmlReport({
        dateStr: today,
        workoutsCount: workouts.length,
        streakDays: chain.current,
        startWeight,
        currentWeight,
        cardioKm: Math.round(totalCardioKm * 10) / 10,
        cardioMinutes: totalCardioMin,
        measurements,
        markdownContent: markdown,
      });

      const filename = `gym95-report-${today}.html`;

      await ctx.telegram.deleteMessage(progressMsg.chat.id, progressMsg.message_id).catch(() => undefined);
      await ctx.replyWithDocument(
        { source: Buffer.from(html, 'utf-8'), filename },
        {
          caption: `📄 *Персональный отчёт gym95 (${today})*\n\n🏋️‍♂️ Тренировок: *${workouts.length}*\n🔥 Стрик: *${chain.current} дн*\n🏃‍♂️ Кардио: *${Math.round(totalCardioKm * 10) / 10} км*\n⚖️ Вес: *${currentWeight ?? '—'} кг*\n\nОткрой файл в браузере — его можно распечатать или сохранить в PDF (Печать → Сохранить как PDF).`,
          parse_mode: 'Markdown',
        }
      );
    } catch (err) {
      console.error('Ошибка создания отчета:', err);
      await ctx.reply('Не удалось сформировать отчет. Попробуй позже.');
    }
  });
}
