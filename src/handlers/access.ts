import { Context, Telegraf } from 'telegraf';
import { config } from '../config';
import { getProfileCached } from '../db/profiles';
import { createInvite } from '../db/invites';
import { decideAccess, extractStartPayload } from './accessDecision';
import { isOnboarding } from './onboarding/state';
import { handleUnprofiledUpdate } from './onboarding';

const DENY_TEXT =
  'Доступ по приглашению. Попроси ссылку у того, кто рассказал тебе о боте.\n' +
  'Если ты уже начинал знакомство — открой ссылку-приглашение ещё раз.';

async function deny(ctx: Context): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery('Доступ по приглашению');
    return;
  }
  if (ctx.message) await ctx.reply(DENY_TEXT);
}

export function registerAccess(bot: Telegraf): void {
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const profile = await getProfileCached(userId);
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    const startPayload = extractStartPayload(text);

    const decision = decideAccess({
      isOwner: userId === config.OWNER_ID,
      hasProfile: profile !== null,
      onboardingInProgress: isOnboarding(userId),
      startPayload,
    });

    if (decision === 'allow') return next();
    if (decision === 'deny') return deny(ctx);
    return handleUnprofiledUpdate(ctx, next, startPayload);
  });

  bot.command('invite', async (ctx) => {
    if (ctx.from.id !== config.OWNER_ID) return;
    const code = await createInvite(ctx.from.id);
    await ctx.reply(
      `Ссылка-приглашение (одноразовая):\nhttps://t.me/${ctx.botInfo.username}?start=inv_${code}\n\n` +
        'Отправь её другу — по ней он пройдёт знакомство с ботом.'
    );
  });
}
