import { Context, Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { getDraft } from '../workout/state';
import { renderExerciseMenu } from '../workout/exerciseNameStep';
import { getExercisesByWorkoutId } from '../../db/exercises';
import { getCardioSessionsForWorkouts } from '../../db/cardio';
import { getLastWorkoutForTemplates, getTemplate, listTemplates, WorkoutTemplate } from '../../db/templates';
import { getUserTimezone } from '../../db/profiles';
import { suggestNextInRotation } from '../../utils/chain';
import { parseSetsLine } from '../../utils/setsParser';
import { parseCardioLine } from '../../utils/parse';
import { formatCardioInline, formatSetsInline } from '../../utils/format';
import { localNow } from '../../utils/time';
import { DraftWorkout } from '../../types/draft';

const BUTTON_LABEL_MAX = 26;
const cut = (s: string) => (s.length > BUTTON_LABEL_MAX ? `${s.slice(0, BUTTON_LABEL_MAX - 1)}…` : s);

function dateLabel(date?: string): string {
  if (!date) return '';
  const [, m, d] = date.split('-');
  return `📅 ${d}.${m}\n`;
}

// Какой шаблон предложить первым: следующий в чередовании фулбади.
async function suggestedTemplate(userId: number, templates: WorkoutTemplate[]): Promise<WorkoutTemplate | null> {
  const rotation = templates
    .filter((t) => t.rotation_group === 'fullbody')
    .sort((a, b) => (a.rotation_order ?? 0) - (b.rotation_order ?? 0));
  if (rotation.length === 0) return null;
  const last = await getLastWorkoutForTemplates(userId, rotation.map((t) => t.id));
  const nextId = suggestNextInRotation(rotation.map((t) => t.id), last?.template_id ?? null);
  return rotation.find((t) => t.id === nextId) ?? null;
}

// Первый экран /new_workout: шаблоны, «С нуля», «Другая дата».
export async function renderTemplatePicker(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const draft = getDraft(userId);
  if (!draft) return;
  draft.step = 'choosing_template';

  const templates = await listTemplates(userId);
  const suggested = await suggestedTemplate(userId, templates);

  const rows: InlineKeyboardButton[][] = [];
  if (suggested) rows.push([Markup.button.callback(`▶ ${cut(suggested.name)}`, `tp:use:${suggested.id}`)]);
  const rest = templates.filter((t) => t.id !== suggested?.id).map((t) => Markup.button.callback(cut(t.name), `tp:use:${t.id}`));
  for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2));
  rows.push([Markup.button.callback('🆕 С нуля', 'w:scratch'), Markup.button.callback('📅 Другая дата', 'w:date')]);
  rows.push([Markup.button.callback('❌ Отменить тренировку', 'w:cancel_workout')]);

  const text =
    dateLabel(draft.date) +
    'Что сегодня тренируешь?' +
    (suggested ? `\nПо очереди: ${suggested.name}` : '');
  const reply_markup = Markup.inlineKeyboard(rows).reply_markup;

  if (viaEdit) await ctx.editMessageText(text, { reply_markup });
  else await ctx.reply(text, { reply_markup });
}

// Выбор шаблона: черновик заполняется значениями прошлого раза по этому шаблону
// (или значениями самого шаблона, если по нему ещё не тренировались).
export async function handleTemplateChosen(ctx: Context, templateId: string): Promise<void> {
  const userId = ctx.from!.id;
  const draft = getDraft(userId);
  if (!draft) return;

  const tpl = await getTemplate(userId, templateId);
  if (!tpl) {
    await ctx.reply('Шаблон не найден — возможно, его удалили.');
    return;
  }

  const last = await getLastWorkoutForTemplates(userId, [tpl.id]);
  let exercises = tpl.exercises;
  let cardio = tpl.cardio;
  let type: DraftWorkout['type'] = tpl.type;

  if (last) {
    const [lastExercises, lastCardio] = await Promise.all([
      getExercisesByWorkoutId(last.id),
      getCardioSessionsForWorkouts([last.id]),
    ]);
    exercises = lastExercises.map((e) => ({ name: e.name, sets: e.sets }));
    const c = lastCardio[0];
    cardio = c ? { activity: c.activity, durationMinutes: last.duration_minutes, distanceKm: c.distance_km } : null;
    type = last.type === 'pool' ? tpl.type : last.type;
  }

  draft.type = type;
  draft.templateId = tpl.id;
  draft.templateName = tpl.name;
  draft.templateLastDate = last?.date;
  draft.exercises = exercises.map((e, i) => ({ name: e.name, sets: e.sets.map((s) => ({ ...s })), orderIndex: i }));
  draft.cardio = cardio
    ? {
        activity: cardio.activity,
        durationMinutes: cardio.durationMinutes ?? undefined,
        distanceKm: cardio.distanceKm ?? undefined,
      }
    : undefined;

  await renderTemplatePreview(ctx, userId, true);
}

async function previewText(draft: DraftWorkout, userId: number): Promise<string> {
  const lines: string[] = [];
  let header = `📋 ${draft.templateName}`;
  if (draft.templateLastDate) {
    const tz = await getUserTimezone(userId);
    const [, m, d] = localNow(tz, new Date(draft.templateLastDate)).dateStr.split('-');
    header += ` · прошлый раз ${d}.${m}`;
  }
  lines.push(dateLabel(draft.date) + header, '');

  if (draft.cardio?.activity) {
    lines.push(
      formatCardioInline({
        activity: draft.cardio.activity,
        durationMinutes: draft.cardio.durationMinutes ?? null,
        distanceKm: draft.cardio.distanceKm ?? null,
        avgHeartRate: null,
      }),
      ''
    );
  }

  draft.exercises.forEach((e, i) => lines.push(`${i + 1}. ${e.name} — ${formatSetsInline(e.sets)}`));
  if (draft.exercises.length > 0) lines.push('');

  lines.push(
    draft.templateLastDate
      ? 'Подставлено из прошлого раза. Поправь, что было по-другому, и сохрани.'
      : 'Это значения из шаблона. Поправь под себя (вес, повторы) и сохрани — в следующий раз подставятся твои.'
  );
  if (draft.exercises.some((e) => e.name === 'Планка')) lines.push('Планка — в секундах.');
  return lines.join('\n');
}

function previewKeyboard(draft: DraftWorkout) {
  const rows: InlineKeyboardButton[][] = [];
  if (draft.cardio?.activity) rows.push([Markup.button.callback('✏️ Время и км', 'tp:cardio')]);
  draft.exercises.forEach((e, i) =>
    rows.push([
      Markup.button.callback(`✏️ ${i + 1}. ${cut(e.name)}`, `tp:ed:${i}`),
      Markup.button.callback('🗑', `tp:rm:${i}`),
    ])
  );
  rows.push([Markup.button.callback('➕ Добавить упражнение', 'tp:add')]);
  rows.push([Markup.button.callback('✅ Сохранить тренировку', 'w:finish')]);
  rows.push([Markup.button.callback('❌ Отменить', 'w:cancel_workout')]);
  return Markup.inlineKeyboard(rows).reply_markup;
}

export async function renderTemplatePreview(ctx: Context, userId: number, viaEdit: boolean): Promise<void> {
  const draft = getDraft(userId);
  if (!draft) return;
  draft.step = 'reviewing_template';
  draft.editingIndex = undefined;
  const text = await previewText(draft, userId);
  if (viaEdit) await ctx.editMessageText(text, { reply_markup: previewKeyboard(draft) });
  else await ctx.reply(text, { reply_markup: previewKeyboard(draft) });
}

export async function handleTemplateEditExercise(ctx: Context, index: number): Promise<void> {
  const userId = ctx.from!.id;
  const draft = getDraft(userId);
  const ex = draft?.exercises[index];
  if (!draft || draft.step !== 'reviewing_template' || !ex) return;
  draft.step = 'editing_template_exercise';
  draft.editingIndex = index;
  await ctx.reply(
    `${ex.name}. Сейчас: ${formatSetsInline(ex.sets)}\n` +
      'Введи подходы, как сделал, например: 40x10, 40x10, 42.5x8\n(без веса — просто повторы: 15, 15, 12)'
  );
}

export async function handleTemplateSetsEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from!.id;
  const draft = getDraft(userId);
  if (!draft || draft.editingIndex === undefined) return;
  const ex = draft.exercises[draft.editingIndex];
  const parsed = parseSetsLine(text);
  if (!parsed.ok) {
    await ctx.reply(parsed.error);
    return;
  }
  if (ex) ex.sets = parsed.sets;
  await renderTemplatePreview(ctx, userId, false);
}

export async function handleTemplateRemoveExercise(ctx: Context, index: number): Promise<void> {
  const userId = ctx.from!.id;
  const draft = getDraft(userId);
  if (!draft || draft.step !== 'reviewing_template' || !draft.exercises[index]) return;
  draft.exercises.splice(index, 1);
  draft.exercises.forEach((e, i) => (e.orderIndex = i));
  await renderTemplatePreview(ctx, userId, true);
}

export async function handleTemplateEditCardio(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const draft = getDraft(userId);
  if (!draft || draft.step !== 'reviewing_template' || !draft.cardio) return;
  draft.step = 'editing_template_cardio';
  await ctx.reply('Сколько минут и километров? Например: 48 4 (км можно не писать)');
}

export async function handleTemplateCardioEntered(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from!.id;
  const draft = getDraft(userId);
  if (!draft?.cardio) return;
  const parsed = parseCardioLine(text);
  if (!parsed.ok) {
    await ctx.reply(parsed.error);
    return;
  }
  draft.cardio.durationMinutes = parsed.minutes;
  draft.cardio.distanceKm = parsed.distanceKm ?? undefined;
  await renderTemplatePreview(ctx, userId, false);
}

// «Добавить упражнение» переводит черновик в обычный поток выбора упражнения;
// кардио-шаблон при этом становится смешанной тренировкой.
export async function handleTemplateAddExercise(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const draft = getDraft(userId);
  if (!draft || draft.step !== 'reviewing_template') return;
  if (draft.type === 'cardio') draft.type = 'mixed';
  await renderExerciseMenu(ctx, userId, true);
}
