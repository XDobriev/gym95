import { getWebApp } from './telegram';
import type { HistoryResponse, ProgressResponse, SummaryResponse, WorkoutUpdateRequest } from '../shared/types';

// В деве initData пустой (открыто не из Telegram) — тогда API вернёт 401,
// и мы покажем понятное сообщение «открой через Telegram».
function initDataHeader(): Record<string, string> {
  const initData = getWebApp()?.initData ?? '';
  return { 'X-Telegram-Init-Data': initData };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: initDataHeader() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }
  return res.json() as Promise<T>;
}

async function send(path: string, method: 'PUT' | 'DELETE', body?: unknown): Promise<void> {
  const res = await fetch(path, {
    method,
    headers: { ...initDataHeader(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // тело не JSON — оставляем statusText
    }
    throw new ApiError(res.status, message);
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HelloResponse {
  userId: number;
  firstName: string | null;
}

export const api = {
  hello: () => get<HelloResponse>('/api/hello'),
  summary: () => get<SummaryResponse>('/api/summary'),
  history: (offset: number, limit: number) =>
    get<HistoryResponse>(`/api/history?offset=${offset}&limit=${limit}`),
  exercises: () => get<{ names: string[] }>('/api/exercises'),
  progress: (exercise: string) =>
    get<ProgressResponse>(`/api/progress?exercise=${encodeURIComponent(exercise)}`),
  updateWorkout: (id: string, body: WorkoutUpdateRequest) =>
    send(`/api/workout/${encodeURIComponent(id)}`, 'PUT', body),
  deleteWorkout: (id: string) => send(`/api/workout/${encodeURIComponent(id)}`, 'DELETE'),
};
