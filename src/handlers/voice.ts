import { Context, Telegraf } from 'telegraf';
import { isAiConfigured } from '../ai/foodEstimate';
import { parseVoiceAction } from '../ai/voiceAssistant';
import { addWater } from '../db/water';
import { addBodyWeight, getUserTimezone } from '../db/profiles';
import { upsertSleep } from '../db/sleep';
import { addFood } from '../db/food';
import { createWorkout } from '../db/workouts';
import { addExercise } from '../db/exercises';
import { addCardioSession, getCardioHistory } from '../db/cardio';
import { getWaterStatus, waterStatusText } from '../modules/water';
import { localNow } from '../utils/time';
import { estimateFood } from '../ai/foodEstimate';
import { formatKcal, MEAL_LABELS } from '../utils/food';
import { getDraft } from './workout/state';
import { computeAvgPace } from '../utils/cardio';
import { generateCardioSummary } from '../utils/cardioSummary';
import { handleSetsTextEntered } from './workout/setsInputStep';
import { handleCustomExerciseNameEntered } from './workout/exerciseNameStep';
import { handleWarmupMinutesEntered } from './workout/typeStep';

export function registerVoice(bot: Telegraf): void {
  bot.on('voice', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    if (!isAiConfigured()) {
      await ctx.reply(
        '🎙 Голосовой ввод требует настроенного ключа Gemini в переменных бота. Пока пиши текстом: /weight, /water, /food, /new_workout.'
      );
      return;
    }

    const voice = ctx.message.voice;
    const progress = await ctx.reply('🎧 Слушаю и распознаю голосовое…');

    const edit = (t: string, extra?: Record<string, unknown>) =>
      ctx.telegram.editMessageText(progress.chat.id, progress.message_id, undefined, t, extra).catch(() => undefined);

    try {
      const fileLink = await ctx.telegram.getFileLink(voice.file_id);
      const res = await fetch(fileLink.toString());
      const arrayBuf = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuf).toString('base64');

      const action = await parseVoiceAction(base64, voice.mime_type ?? 'audio/ogg');
      const tz = await getUserTimezone(userId);
      const today = localNow(tz).dateStr;

      const draft = getDraft(userId);

      // Если пользователь прямо сейчас вводит подходы внутри /new_workout
      if (draft && draft.step === 'entering_sets') {
        let setsStr = '';
        if (action.action === 'sets' && action.sets.length > 0) {
          setsStr = action.sets.map((s) => (s.weight > 0 ? `${s.weight}x${s.reps}` : `${s.reps}`)).join(', ');
        } else if (action.action === 'workout' && action.exercises[0]?.sets?.length > 0) {
          setsStr = action.exercises[0].sets.map((s) => (s.weight > 0 ? `${s.weight}x${s.reps}` : `${s.reps}`)).join(', ');
        }

        if (setsStr) {
          await edit(`🎙 «${action.transcript}»\n\nЗаписываю подходы: ${setsStr}…`);
          await handleSetsTextEntered(ctx, setsStr);
          return;
        }
      }

      // Если пользователь называет кастомное упражнение голосом
      if (draft && draft.step === 'entering_custom_exercise_name' && action.transcript) {
        await edit(`🎙 «${action.transcript}»\n\nВыбираю упражнение: ${action.transcript}…`);
        await handleCustomExerciseNameEntered(ctx, action.transcript);
        return;
      }

      // Если пользователь диктует минуты разминки
      if (draft && draft.step === 'entering_warmup' && action.transcript) {
        await edit(`🎙 «${action.transcript}»\n\nЗаписываю разминку…`);
        await handleWarmupMinutesEntered(ctx, action.transcript);
        return;
      }

      switch (action.action) {
        case 'water': {
          await addWater(userId, today, action.ml);
          const status = await getWaterStatus(userId, tz, today);
          await edit(`🎙 «${action.transcript}»\n\n💧 Записано +${action.ml} мл воды!\n\n${waterStatusText(status)}`);
          return;
        }

        case 'weight': {
          await addBodyWeight(userId, action.kg);
          await edit(`🎙 «${action.transcript}»\n\n⚖️ Вес ${action.kg} кг записан!`);
          return;
        }

        case 'sleep': {
          await upsertSleep(userId, today, action.hours);
          await edit(`🎙 «${action.transcript}»\n\n😴 Сон ${action.hours} ч записан за ночь!`);
          return;
        }

        case 'food': {
          const mealTitle = action.meal ? MEAL_LABELS[action.meal] : '🍽 Приём пищи';

          if (action.kcal) {
            await addFood({
              userId,
              eatenOn: today,
              description: action.description,
              kcal: action.kcal,
              meal: action.meal ?? null,
            });
            await edit(
              `🎙 «${action.transcript}»\n\n${mealTitle} записан: ${action.description} (${formatKcal(action.kcal)} ккал)`
            );
          } else {
            // Оцениваем ккал через модель
            const est = await estimateFood(action.description).catch(() => null);
            if (est && est.isFood) {
              await addFood({
                userId,
                eatenOn: today,
                description: est.name,
                kcal: est.kcal,
                meal: action.meal ?? null,
              });
              await edit(
                `🎙 «${action.transcript}»\n\n${mealTitle} записан: ${est.name} (≈ ${formatKcal(est.kcal)} ккал${est.proteinG ? `, белок ~${est.proteinG} г` : ''})`
              );
            } else {
              await edit(
                `🎙 «${action.transcript}»\n\nБлюдо «${action.description}» распознано, но калории неизвестны. Напиши с числом, например: «${action.description} 450»`
              );
            }
          }
          return;
        }

        case 'cardio': {
          const distance = action.distanceKm ?? (action.laps ? Math.round(action.laps * 0.4 * 100) / 100 : null);
          const duration = action.durationMinutes ?? null;
          const workout = await createWorkout({
            userId,
            type: 'cardio',
            durationMinutes: duration ?? undefined,
          });

          const avgPace = duration && distance ? computeAvgPace(duration, distance) : null;

          await addCardioSession({
            workoutId: workout.id,
            activity: action.activity,
            distanceKm: distance,
            avgHeartRate: null,
            avgPace,
            inclinePercent: null,
          });

          // Считаем предыдущие круги пользователя для расчета ачивок
          const cardioHistory = await getCardioHistory(userId).catch(() => []);
          const previousLaps = cardioHistory.reduce((sum, h) => {
            if (h.activity === 'walking' || h.activity === 'running') {
              return sum + (h.distanceKm ? Math.round((h.distanceKm / 0.4) * 10) / 10 : 0);
            }
            return sum;
          }, 0);

          const summary = generateCardioSummary({
            activity: action.activity,
            durationMinutes: duration ?? 0,
            distanceKm: distance,
            totalPreviousLaps: previousLaps,
          });

          const actNames = {
            walking: 'Ходьба / Стадион',
            running: 'Бег',
            treadmill: 'Беговая дорожка',
            bike: 'Велосипед',
            pool: 'Бассейн',
          };

          await edit(
            `🎙 «${action.transcript}»\n\n🏃 Тренировка сохранена: ${actNames[action.activity]}!\n\n${summary.lines.join('\n')}\n\nИстория — /history`
          );
          return;
        }

        case 'workout': {
          if (!action.exercises || action.exercises.length === 0) {
            await edit(
              `🎙 «${action.transcript}»\n\nНе удалось распознать упражнения в тренировке. Назови упражнения и подходы (например: «Жим 80 на 10 три подхода»).`
            );
            return;
          }

          const workout = await createWorkout({
            userId,
            type: 'strength',
            durationMinutes: action.durationMinutes ?? undefined,
          });

          for (let i = 0; i < action.exercises.length; i++) {
            const ex = action.exercises[i];
            await addExercise({
              workoutId: workout.id,
              name: ex.name,
              sets: ex.sets.map((s) => ({ weight: s.weight, reps: s.reps })),
              orderIndex: i,
            });
          }

          const summaryLines = action.exercises.map(
            (e) => `• ${e.name}: ${e.sets.map((s) => (s.weight > 0 ? `${s.weight}×${s.reps}` : `×${s.reps}`)).join(', ')}`
          );
          const durationText = action.durationMinutes ? ` (${action.durationMinutes} мин)` : '';

          await edit(
            `🎙 «${action.transcript}»\n\n🏋️ Силовая тренировка сохранена${durationText}!\n\n${summaryLines.join('\n')}\n\nИстория — /history`
          );
          return;
        }

        case 'sets': {
          await edit(
            `🎙 «${action.transcript}»\n\nРаспознаны подходы: ${action.sets.map((s) => (s.weight > 0 ? `${s.weight}×${s.reps}` : `×${s.reps}`)).join(', ')}.\n\nЧтобы записать их в тренировку, нажми /new_workout или выбери упражнение!`
          );
          return;
        }

        case 'unknown':
        default: {
          await edit(
            `🎙 Распознано: «${action.transcript}»\n\nНе понял действие для дневника 🤔\n\nМожно сказать голосом:\n• «Выпил 300 мл воды»\n• «Вес 84.2»\n• «Спал 7.5 часов»\n• «На завтрак овсянка с ягодами 350»\n• «Пробежал 10 кругов на стадионе за 35 минут»\n• «Тренировка: жим 80 по 10 три подхода, подтягивания 12»`
          );
          return;
        }
      }
    } catch (err) {
      console.error('Ошибка обработки голосового сообщения:', err);
      await edit('Не удалось обработать голосовое сообщение. Попробуй ещё раз или используй текст.');
    }
  });
}
