import { IncomingMessage, ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { validateInitData, AuthError, AuthedUser } from './initData';
import { getHistoryPage, getExerciseNames, getProgress, getSummary } from './queries';

// Статика собранного Mini App. tsc компилирует src/ → dist/, а бот на Render
// запускается из корня репозитория, поэтому webapp/dist лежит рядом с process.cwd().
const STATIC_ROOT = path.resolve(process.cwd(), 'webapp', 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function authOrThrow(req: IncomingMessage): AuthedUser {
  const header = req.headers['x-telegram-init-data'];
  const initData = Array.isArray(header) ? header[0] : header ?? '';
  return validateInitData(initData);
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  let user: AuthedUser;
  try {
    user = authOrThrow(req);
  } catch (err) {
    const message = err instanceof AuthError ? err.message : 'Ошибка авторизации';
    sendJson(res, 401, { error: message });
    return;
  }

  try {
    switch (url.pathname) {
      case '/api/hello':
        sendJson(res, 200, { userId: user.userId, firstName: user.firstName });
        return;

      case '/api/summary':
        sendJson(res, 200, await getSummary(user.userId));
        return;

      case '/api/history': {
        const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
        const rawLimit = parseInt(url.searchParams.get('limit') ?? '20', 10) || 20;
        const limit = Math.min(50, Math.max(1, rawLimit));
        sendJson(res, 200, await getHistoryPage(user.userId, offset, limit));
        return;
      }

      case '/api/exercises':
        sendJson(res, 200, { names: await getExerciseNames(user.userId, 100) });
        return;

      case '/api/progress': {
        const exercise = (url.searchParams.get('exercise') ?? '').trim();
        if (!exercise) {
          sendJson(res, 400, { error: 'Не указано упражнение' });
          return;
        }
        sendJson(res, 200, { exercise, points: await getProgress(user.userId, exercise) });
        return;
      }

      default:
        sendJson(res, 404, { error: 'Не найдено' });
    }
  } catch (err) {
    console.error('Ошибка API Mini App:', err);
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Ошибка сервера' });
  }
}

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  // Защита от path traversal: нормализуем и держим внутри STATIC_ROOT.
  const rel = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let filePath = path.join(STATIC_ROOT, rel);
  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let data = await tryReadFile(filePath);
  if (!data) {
    // SPA-фолбэк: любой неизвестный путь отдаёт index.html.
    filePath = path.join(STATIC_ROOT, 'index.html');
    data = await tryReadFile(filePath);
  }

  if (!data) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Mini App ещё не собран (нет webapp/dist).');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
  res.end(data);
}

async function tryReadFile(filePath: string): Promise<Buffer | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return null;
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

// Единый обработчик для http.createServer: /api/* → JSON, health → 200, всё
// остальное → статика Mini App (webapp/dist) со SPA-фолбэком.
export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    void handleApi(req, res, url);
    return;
  }

  void serveStatic(res, url.pathname);
}
