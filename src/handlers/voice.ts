import { Context, Telegraf, Markup } from 'telegraf';
import { isAiConfigured } from '../ai/foodEstimate';
import { parseVoiceAction } from '../ai/voiceAssistant';
import { addWater } from '../db/water';
import { addBodyWeight, getUserTimezone } from '../db/profiles';
import { upsertSleep } from '../db/sleep';
import { addFood, getFoodBetween } from '../db/food';
import { createWorkout } from '../db/workouts';
import { addCardioSession } from '../db/cardio';
import { getWaterStatus, waterStatusText } from '../modules/water';
import { localNow } from '../utils/time';
import { estimateFood } from '../ai/foodEstimate';
import { formatKcal } from '../utils/food';
import { getDraft } from './workout/state';
import { computeAvgPace } from '../utils/cardio';

export function registerVoice(bot: Telegraf): void {
  bot.on('voice', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Если прямо сейчас идёт создание тренировки через кнопки — пусть текст/голос не ломает FSM
    if (getDraft(userId)) return next();

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
          if (action.kcal) {
            await addFood({
              userId,
              eatenOn: today,
              description: action.description,
              kcal: action.kcal,
              meal: null,
            });
            await edit(
              `🎙 «${action.transcript}»\n\n🍽 Записано: ${action.description} (${formatKcal(action.kcal)} ккал)`
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
                meal: null,
              });
              await edit(
                `🎙 «${action.transcript}»\n\n🍽 Записано: ${est.name} (≈ ${formatKcal(est.kcal)} ккал${est.proteinG ? `, белок ~${est.proteinG} г` : ''})`
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

          const actNames = {
            walking: 'Ходьба / Стадион',
            running: 'Бег',
            treadmill: 'Беговая дорожка',
            bike: 'Велосипед',
            pool: 'Бассейн',
          };

          const details: string[] = [];
          if (action.laps) details.push(`${action.laps} кругов (~${distance} км)`);
          else if (distance) details.push(`${distance} км`);
          if (duration) details.push(`${duration} мин`);
          if (avgPace) details.push(`темп ${avgPace}`);

          await edit(
            `🎙 «${action.transcript}»\n\n🏃 Тренировка сохранена: ${actNames[action.activity]}!\n${details.join(' · ')}\n\nИстория — /history`
          );
          return;
        }

        case 'unknown':
        default: {
          await edit(
            `🎙 Распознано: «${action.transcript}»\n\nНе понял действие для дневника 🤔\n\nМожно сказать голосом:\n• «Выпил 300 мл воды» или «Выпил стакан воды»\n• «Вес 84.2»\n• «Спал 7 с половиной часов»\n• «Обед гречка с курицей 550»\n• «Пробежал 10 кругов на стадионе за 35 минут»`
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
