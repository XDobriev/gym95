import { Telegraf, Context, Markup } from 'telegraf';
import { getExerciseHistory, getLastExercisesByUser } from '../db/exercises';
import { formatDateShortRu, formatSetsInline } from '../utils/format';

async function renderProgress(userId: number, exerciseName: string): Promise<string> {
  const history = await getExerciseHistory(userId, exerciseName);

  if (history.length === 0) {
    return `Пока нет истории по «${exerciseName}».`;
  }

  const lines = history.map((entry) => `${formatDateShortRu(entry.date)}: ${formatSetsInline(entry.sets)}`);
  return `📈 ${exerciseName}\n\n${lines.join('\n')}`;
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
      await ctx.reply(await renderProgress(userId, exerciseName));
      return;
    }

    const recentNames = await getLastExercisesByUser(userId, 6);
    if (recentNames.length === 0) {
      await ctx.reply('Пока нет ни одного упражнения. Начни с /new_workout');
      return;
    }

    const keyboard = Markup.inlineKeyboard(
      recentNames.map((name, index) => [Markup.button.callback(name, `p:${index}`)])
    ).reply_markup;

    await ctx.reply('По какому упражнению показать прогресс?', { reply_markup: keyboard });
  });

  bot.action(/^p:(\d+)$/, async (ctx: Context & { match: RegExpMatchArray }) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const index = parseInt(ctx.match[1], 10);
    const recentNames = await getLastExercisesByUser(userId, 6);
    const exerciseName = recentNames[index];
    if (!exerciseName) return;

    await ctx.editMessageText(await renderProgress(userId, exerciseName));
  });
}
