import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';
import { getHistoryPage } from './_lib/queries';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = authenticate(req, res);
  if (!user) return;

  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const rawLimit = parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));

  try {
    const page = await getHistoryPage(user.userId, offset, limit);
    res.status(200).json(page);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ошибка сервера' });
  }
}
