import { Telegraf, Context, Markup } from 'telegraf';
import { getExerciseHistory, getLastExercisesByUser } from '../db/exercises';
import { getCardioHistory, getLastCardioActivitiesByUser } from '../db/cardio';
import { CardioActivity } from '../types/domain';
import { formatDateShortRu, formatSetsInline } from '../utils/format';
import { buildProgressChartUrl, buildCardioProgressChartUrl } from '../utils/chart';
import { calculate1RM, calculateExerciseStats, formatExerciseStatsSummary } from '../utils/oneRepMax';

const TELEGRAM_CAPTION_LIMIT = 1024;

const CARDIO_NAMES: Record<CardioActivity, string> = {
  running: 'Бег',
  walking: 'Ходьба / Стадион',
  treadmill: 'Беговая дорожка',
  bike: 'Велосипед',
  pool: 'Бассейн',
};

const CARDIO_EMOJIS: Record<CardioActivity, string> = {
  running: '🏃',
  walking: '🚶',
  treadmill: '🎽',
  bike: '🚴',
  pool: '🏊',
};

function matchCardioActivity(text: string): CardioActivity | null {
  const lower = text.toLowerCase().trim();
  if (/стадион|ходьб|walk/i.test(lower)) return 'walking';
  if (/бег|run/i.test(lower)) return 'running';
  if (/дорожк|treadmill/i.test(lower)) return 'treadmill';
  if (/вело|bike/i.test(lower)) return 'bike';
  if (/бассейн|плаван|pool/i.test(lower)) return 'pool';
  return null;
}

async function sendCardioProgress(ctx: Context, userId: number, activity: CardioActivity): Promise<void> {
  const history = await getCardioHistory(userId, activity);
  const title = CARDIO_NAMES[activity] ?? activity;
  const emoji = CARDIO_EMOJIS[activity] ?? '🏃';

  if (history.length === 0) {
    await ctx.reply(`📭 Пока нет истории по «${title}». Запиши кардио в /new_workout — и здесь появится график.`);
    return;
  }

  const lines = history.map((entry) => {
    const parts = [formatDateShortRu(entry.date)];
    if (entry.distanceKm !== null && entry.distanceKm > 0) parts.push(`${entry.distanceKm} км`);
    if (entry.durationMinutes !== null) parts.push(`${entry.durationMinutes} мин`);
    if (entry.avgPace) parts.push(`темп ${entry.avgPace}`);
    if (entry.avgHeartRate !== null) parts.push(`пульс ${entry.avgHeartRate}`);
    return parts.join(' · ');
  });

  const text = `📈 ${emoji} ${title}\n\n${lines.join('\n')}`;
  const chartUrl = buildCardioProgressChartUrl(title, history);

  if (text.length <= TELEGRAM_CAPTION_LIMIT) {
    await ctx.replyWithPhoto(chartUrl, { caption: text }).catch(() => ctx.reply(text));
  } else {
    await ctx.replyWithPhoto(chartUrl, { caption: `📈 ${emoji} ${title}` }).catch(() => undefined);
    await ctx.reply(lines.join('\n'));
  }
}

async function sendProgress(ctx: Context, userId: number, exerciseName: string): Promise<void> {
  const cardioMatch = matchCardioActivity(exerciseName);
  if (cardioMatch) {
    await sendCardioProgress(ctx, userId, cardioMatch);
    return;
  }

  const history = await getExerciseHistory(userId, exerciseName);

  if (history.length === 0) {
    await ctx.reply(`📭 Пока нет истории по «${exerciseName}». Запиши его в /new_workout — и здесь появится график.`);
    return;
  }

  const stats = calculateExerciseStats(history);
  const badgeLines = formatExerciseStatsSummary(stats);

  const shownHistory = history.slice(-12);
  const lines = shownHistory.map((entry) => {
    const setsText = formatSetsInline(entry.sets);
    const day1RM = entry.sets.reduce((max, s) => Math.max(max, calculate1RM(s.weight, s.reps)), 0);
    const day1RMSuffix = !stats.isBodyweight && day1RM > 0 ? ` [1RM ~${day1RM} кг]` : '';
    return `${formatDateShortRu(entry.date)}: ${setsText}${day1RMSuffix}`;
  });

  if (history.length > 12) {
    lines.unshift(`...раннее ещё ${history.length - 12} записей...`);
  }

  const header = `📈 ${exerciseName}`;
  const badgesBlock = badgeLines.length > 0 ? badgeLines.join('\n') + '\n\n' : '';
  const historyBlock = `📋 История:\n${lines.join('\n')}`;
  const text = `${header}\n\n${badgesBlock}${historyBlock}`;
  const chartUrl = buildProgressChartUrl(exerciseName, history);

  if (text.length <= TELEGRAM_CAPTION_LIMIT) {
    await ctx.replyWithPhoto(chartUrl, { caption: text }).catch(() => ctx.reply(text));
  } else {
    await ctx.replyWithPhoto(chartUrl, { caption: `📈 ${exerciseName}` }).catch(() => undefined);
    await ctx.reply(text);
  }
}

function getCommandArgs(text: string): string {
  return text.split(' ').slice(1).join(' ').trim();
}

export function registerProgress(bot: Telegraf): void {
  bot.command('progress', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const text = 'text' in ctx.message ? ctx.message.text : '';
    const exerciseName = getCommandArgs(text);

    if (exerciseName.length > 0) {
      await sendProgress(ctx, userId, exerciseName);
      return;
    }

    const [recentNames, recentCardio] = await Promise.all([
      getLastExercisesByUser(userId, 6),
      getLastCardioActivitiesByUser(userId),
    ]);

    if (recentNames.length === 0 && recentCardio.length === 0) {
      await ctx.reply('📭 Пока нет сохранённых тренировок. Начни с /new_workout');
      return;
    }

    const buttons: ReturnType<typeof Markup.button.callback>[][] = [];

    if (recentCardio.length > 0) {
      for (const act of recentCardio) {
        buttons.push([Markup.button.callback(`${CARDIO_EMOJIS[act]} ${CARDIO_NAMES[act]}`, `p:cardio:${act}`)]);
      }
    }

    for (let i = 0; i < recentNames.length; i++) {
      buttons.push([Markup.button.callback(`🏋️ ${recentNames[i]}`, `p:ex:${i}`)]);
    }

    await ctx.reply('📈 По какому упражнению или активности показать прогресс?', {
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
    });
  });

  bot.action(/^p:cardio:(running|walking|treadmill|bike|pool)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await sendCardioProgress(ctx, userId, ctx.match[1] as CardioActivity);
  });

  bot.action(/^p:ex:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const index = parseInt(ctx.match[1], 10);
    const recentNames = await getLastExercisesByUser(userId, 6);
    const exerciseName = recentNames[index];
    if (!exerciseName) return;

    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await sendProgress(ctx, userId, exerciseName);
  });

  // Совместимость со старыми кнопками p:0, p:1...
  bot.action(/^p:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const index = parseInt(ctx.match[1], 10);
    const recentNames = await getLastExercisesByUser(userId, 6);
    const exerciseName = recentNames[index];
    if (!exerciseName) return;

    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await sendProgress(ctx, userId, exerciseName);
  });
}
