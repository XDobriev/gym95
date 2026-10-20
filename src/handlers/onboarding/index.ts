import { Context, Markup, Telegraf } from 'telegraf';
import { config } from '../../config';
import { Goal, GOAL_LABELS, Sex, SEX_LABELS } from '../../types/profile';
import { RU_TIMEZONES, isKnownTimezone, tzLabel } from '../../utils/timezones';
import { parseBodyLine } from '../../utils/parse';
import { waterNormMl, formatLiters } from '../../utils/norms';
import { pluralizeRu } from '../../utils/format';
import { createProfileWithInvite } from '../../db/profiles';
import { upsertModules } from '../../db/modules';
import { initialModuleRows } from '../../modules/registry';
import { getSettings } from '../../db/settings';
import { extractInviteCode } from '../accessDecision';
import { sendToday } from '../today';
import {
  OnboardingSession,
  clearOnboarding,
  getOnboarding,
  isOnboarding,
  startOnboardingSession,
} from './state';

const INVALID_INVITE_TEXT = 'Ссылка недействительна или уже использована. Попроси новую у того, кто тебя пригласил.';

function goalKeyboard() {
  return Markup.inlineKeyboard(
    (Object.keys(GOAL_LABELS) as Goal[]).map((g) => [Markup.button.callback(GOAL_LABELS[g], `ob:goal:${g}`)])
  ).reply_markup;
}

function sexKeyboard() {
  return Markup.inlineKeyboard([
    (Object.keys(SEX_LABELS) as Sex[]).map((s) => Markup.button.callback(SEX_LABELS[s], `ob:sex:${s}`)),
  ]).reply_markup;
}

export function timezoneKeyboard(prefix: string) {
  const buttons = RU_TIMEZONES.map((t) => Markup.button.callback(`${t.label} · ${t.city}`, `${prefix}${t.iana}`));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return Markup.inlineKeyboard(rows).reply_markup;
}

async function sendStep(ctx: Context, s: OnboardingSession): Promise<void> {
  switch (s.step) {
    case 'goal':
      await ctx.reply('Привет! Я дневник тренировок и тела.\n\n1/4 · Какая у тебя цель?', {
        reply_markup: goalKeyboard(),
      });
      return;
    case 'body':
      await ctx.reply('2/4 · Рост, вес и возраст через пробел.\nНапример: 182 95 34');
      return;
    case 'sex':
      await ctx.reply('3/4 · Пол?', { reply_markup: sexKeyboard() });
      return;
    case 'tz':
      await ctx.reply('4/4 · Твой часовой пояс? Нужен, чтобы напоминания приходили вовремя.', {
        reply_markup: timezoneKeyboard('ob:tz:'),
      });
      return;
  }
}

// Вызывается middleware доступа для пользователя без профиля, которому решено
// «onboard». Сам решает: начать знакомство, продолжить или передать апдейт дальше
// (в ob:-кнопки и текстовый обработчик знакомства).
export async function handleUnprofiledUpdate(
  ctx: Context,
  next: () => Promise<void>,
  startPayload: string | null
): Promise<void> {
  const userId = ctx.from!.id;
  const inviteCode = extractInviteCode(startPayload);
  const cbData = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;

  if (!isOnboarding(userId)) {
    const s = startOnboardingSession(userId, inviteCode);
    if (cbData) await ctx.answerCbQuery();
    await sendStep(ctx, s);
    return;
  }

  const s = getOnboarding(userId)!;
  if (inviteCode && !s.inviteCode) s.inviteCode = inviteCode;

  if (cbData?.startsWith('ob:')) return next();
  if (text !== undefined && !text.startsWith('/')) return next();

  if (cbData) {
    await ctx.answerCbQuery('Сначала закончим знакомство');
    return;
  }
  // /start во время знакомства — просто продолжить с текущего шага.
  if (!text?.startsWith('/start')) await ctx.reply('Сначала закончим знакомство 👇');
  await sendStep(ctx, s);
}

async function finish(ctx: Context, userId: number, s: OnboardingSession, timezone: string): Promise<void> {
  const isOwner = userId === config.OWNER_ID;
  if (!isOwner && !s.inviteCode) {
    clearOnboarding(userId);
    await ctx.reply(INVALID_INVITE_TEXT);
    return;
  }

  const birthYear = new Date().getFullYear() - s.age!;
  const result = await createProfileWithInvite({
    userId,
    inviteCode: isOwner ? null : s.inviteCode,
    goal: s.goal!,
    sex: s.sex!,
    birthYear,
    heightCm: s.heightCm!,
    timezone,
    weightKg: s.weightKg!,
  });
  clearOnboarding(userId);

  if (result === 'invite_invalid') {
    await ctx.reply(INVALID_INVITE_TEXT);
    return;
  }

  const waterMl = waterNormMl({ heightCm: s.heightCm!, weightKg: s.weightKg! });
  if (result === 'created') {
    await upsertModules(initialModuleRows(userId, s.goal!, { water: { dailyMl: waterMl } }));
  }

  const settings = await getSettings(userId);
  const goalWord = pluralizeRu(settings.week_goal, ['тренировка', 'тренировки', 'тренировок']);
  await ctx.reply(
    `Готово! Профиль создан.\n\n` +
      `🎯 Цель: ${GOAL_LABELS[s.goal!]}\n` +
      `🕒 Часовой пояс: ${tzLabel(timezone)}\n` +
      `🏋️ Цель недели: ${settings.week_goal} ${goalWord}\n` +
      `💧 Норма воды: ${formatLiters(waterMl)} в день — пригодится, когда появится модуль воды\n\n` +
      `Всё меняется в /settings. Главная команда — /today.`
  );
  await sendToday(ctx, userId);
}

export function registerOnboarding(bot: Telegraf): void {
  bot.action(/^ob:goal:(lose|gain|regular)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const s = getOnboarding(ctx.from.id);
    if (!s || s.step !== 'goal') return;
    s.goal = ctx.match[1] as Goal;
    s.step = 'body';
    await ctx.editMessageText(`1/4 · Цель: ${GOAL_LABELS[s.goal]}`);
    await sendStep(ctx, s);
  });

  bot.action(/^ob:sex:(male|female)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const s = getOnboarding(ctx.from.id);
    if (!s || s.step !== 'sex') return;
    s.sex = ctx.match[1] as Sex;
    s.step = 'tz';
    await ctx.editMessageText(`3/4 · Пол: ${SEX_LABELS[s.sex]}`);
    await sendStep(ctx, s);
  });

  bot.action(/^ob:tz:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const s = getOnboarding(userId);
    const tz = ctx.match[1];
    if (!s || s.step !== 'tz' || !isKnownTimezone(tz)) return;
    await ctx.editMessageText(`4/4 · Часовой пояс: ${tzLabel(tz)}`);
    await finish(ctx, userId, s, tz);
  });

  bot.on('text', async (ctx, next) => {
    const s = getOnboarding(ctx.from.id);
    if (!s) return next();
    if (s.step !== 'body') {
      await sendStep(ctx, s);
      return;
    }
    const parsed = parseBodyLine(ctx.message.text);
    if (!parsed.ok) {
      await ctx.reply(parsed.error);
      return;
    }
    s.heightCm = parsed.heightCm;
    s.weightKg = parsed.weightKg;
    s.age = parsed.age;
    s.step = 'sex';
    await sendStep(ctx, s);
  });
}
