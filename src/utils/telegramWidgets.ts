/**
 * Telegram Bot API 10.4 Interactive HTML Widgets Adapter
 * 
 * Provides transport methods (sendWidget, editMessageWidgetData, answerWidgetQuery)
 * and compact state serialization for in-chat QuickJS interactive widgets.
 */

export interface WidgetSendOptions {
  chat_id: number | string;
  html: string; // up to 32 KB HTML+CSS+JS
  chat_data?: string; // initial JSON state up to 1024 bytes
  reply_to_message_id?: number;
}

export interface WidgetDataEditOptions {
  chat_id: number | string;
  message_id: number;
  chat_data: string; // updated JSON state up to 1024 bytes
}

export interface WidgetQueryAnswerOptions {
  widget_query_id: string;
  text?: string;
  show_alert?: boolean;
}

export type LiveWorkoutMode = 'active' | 'resting' | 'done';

export interface LiveWorkoutCompletedSet {
  w: number;
  r: number;
}

export interface LiveWorkoutWidgetState {
  wid: string; // workout_id or draft id
  ex: string; // exercise name
  sn: number; // set number (1-based)
  st: number; // sets total target
  w: number; // current weight (kg)
  r: number; // current reps
  pw?: number; // previous weight (ghost)
  pr?: number; // previous reps (ghost)
  m: LiveWorkoutMode; // mode: active | resting | done
  rta?: number; // rest_ends_at timestamp (ms)
  rd?: number; // rest duration in seconds (default 90)
  completedSets?: LiveWorkoutCompletedSet[]; // summary of sets completed so far
}

export type WidgetActionType =
  | 'finish_set'
  | 'skip_rest'
  | 'add_rest'
  | 'finish_exercise'
  | 'add_set'
  | 'next_exercise'
  | 'finish_workout';

export interface TelegramWidgetQueryPayload {
  action: WidgetActionType;
  weight?: number;
  reps?: number;
  setIndex?: number;
  restAdded?: number;
}

export interface WidgetQueryData {
  id: string;
  from: {
    id: number;
    is_bot?: boolean;
    first_name: string;
    username?: string;
  };
  message?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
    };
  };
  chat_instance?: string;
  data?: string; // JSON payload from TelegramWidget.request(...)
}

export interface TelegramApiCallable {
  callApi: (method: any, data: any) => Promise<any>;
}

export const MAX_CHAT_DATA_BYTES = 1024;
export const MAX_WIDGET_HTML_BYTES = 32768; // 32 KB limit

/**
 * Checks if raw chat_data string fits within the Telegram 1024 bytes limit.
 */
export function validateWidgetDataSize(raw: string): boolean {
  return Buffer.byteLength(raw, 'utf8') <= MAX_CHAT_DATA_BYTES;
}

/**
 * Serializes state to compact JSON and validates size limit.
 */
export function serializeWidgetData(state: LiveWorkoutWidgetState): string {
  // Strip undefined keys to keep JSON compact
  const compact: Record<string, unknown> = {
    wid: state.wid,
    ex: state.ex,
    sn: state.sn,
    st: state.st,
    w: Math.round(state.w * 10) / 10,
    r: Math.round(state.r),
    m: state.m,
  };

  if (state.pw !== undefined) compact.pw = Math.round(state.pw * 10) / 10;
  if (state.pr !== undefined) compact.pr = Math.round(state.pr);
  if (state.rta !== undefined) compact.rta = state.rta;
  if (state.rd !== undefined) compact.rd = state.rd;
  if (state.completedSets && state.completedSets.length > 0) {
    compact.completedSets = state.completedSets.map((s) => ({
      w: Math.round(s.w * 10) / 10,
      r: Math.round(s.r),
    }));
  }

  const json = JSON.stringify(compact);
  if (!validateWidgetDataSize(json)) {
    // If completedSets made it exceed limit, keep only count or last 3 sets
    if (compact.completedSets && Array.isArray(compact.completedSets)) {
      compact.completedSets = compact.completedSets.slice(-3);
      const reduced = JSON.stringify(compact);
      if (validateWidgetDataSize(reduced)) return reduced;
      delete compact.completedSets;
    }
    let trimmed = JSON.stringify(compact);
    if (!validateWidgetDataSize(trimmed)) {
      // If still exceeding, trim very long exercise title
      compact.ex = String(compact.ex).slice(0, 50);
      trimmed = JSON.stringify(compact);
      if (validateWidgetDataSize(trimmed)) return trimmed;
      throw new Error(`Serialized chat_data exceeds ${MAX_CHAT_DATA_BYTES} bytes limit (${Buffer.byteLength(trimmed, 'utf8')} bytes)`);
    }
    return trimmed;
  }
  return json;
}

/**
 * Deserializes JSON string back to typed LiveWorkoutWidgetState.
 */
export function deserializeWidgetData(raw: string): LiveWorkoutWidgetState {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid widget data payload');
    }

    return {
      wid: String(parsed.wid ?? ''),
      ex: String(parsed.ex ?? ''),
      sn: Number(parsed.sn ?? 1),
      st: Number(parsed.st ?? 4),
      w: Number(parsed.w ?? 0),
      r: Number(parsed.r ?? 0),
      pw: parsed.pw !== undefined ? Number(parsed.pw) : undefined,
      pr: parsed.pr !== undefined ? Number(parsed.pr) : undefined,
      m: (parsed.m === 'resting' || parsed.m === 'done' ? parsed.m : 'active') as LiveWorkoutMode,
      rta: parsed.rta !== undefined ? Number(parsed.rta) : undefined,
      rd: parsed.rd !== undefined ? Number(parsed.rd) : 90,
      completedSets: Array.isArray(parsed.completedSets)
        ? parsed.completedSets.map((s: any) => ({ w: Number(s.w || 0), r: Number(s.r || 0) }))
        : undefined,
    };
  } catch (err) {
    throw new Error(`Failed to parse widget chat_data: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Parses query payload sent by client-side TelegramWidget.request()
 */
export function parseWidgetQueryPayload(raw: string | undefined): TelegramWidgetQueryPayload {
  if (!raw) {
    return { action: 'finish_set' };
  }
  try {
    const data = JSON.parse(raw);
    return {
      action: data.action || 'finish_set',
      weight: data.weight !== undefined ? Number(data.weight) : undefined,
      reps: data.reps !== undefined ? Number(data.reps) : undefined,
      setIndex: data.setIndex !== undefined ? Number(data.setIndex) : undefined,
      restAdded: data.restAdded !== undefined ? Number(data.restAdded) : undefined,
    };
  } catch {
    return { action: 'finish_set' };
  }
}

/**
 * Computes total volume tonnage (kg) from completed sets.
 */
export function calculateCompletedTonnage(sets: LiveWorkoutCompletedSet[]): number {
  return sets.reduce((sum, s) => sum + s.w * s.r, 0);
}

/**
 * Low-level Telegram callApi: sendWidget
 */
export async function sendWidget(
  telegram: TelegramApiCallable,
  options: WidgetSendOptions
): Promise<any> {
  const byteLength = Buffer.byteLength(options.html, 'utf8');
  if (byteLength > MAX_WIDGET_HTML_BYTES) {
    throw new Error(`Widget HTML exceeds 32 KB limit: ${byteLength} bytes`);
  }
  if (options.chat_data && !validateWidgetDataSize(options.chat_data)) {
    throw new Error(`Widget chat_data exceeds 1024 bytes limit`);
  }

  return await telegram.callApi('sendWidget', options as unknown as Record<string, unknown>);
}

/**
 * Low-level Telegram callApi: editMessageWidgetData
 */
export async function editMessageWidgetData(
  telegram: TelegramApiCallable,
  options: WidgetDataEditOptions
): Promise<any> {
  if (!validateWidgetDataSize(options.chat_data)) {
    throw new Error(`Widget chat_data exceeds 1024 bytes limit`);
  }

  return await telegram.callApi('editMessageWidgetData', options as unknown as Record<string, unknown>);
}

/**
 * Low-level Telegram callApi: answerWidgetQuery
 */
export async function answerWidgetQuery(
  telegram: TelegramApiCallable,
  options: WidgetQueryAnswerOptions
): Promise<any> {
  return await telegram.callApi('answerWidgetQuery', options as unknown as Record<string, unknown>);
}
