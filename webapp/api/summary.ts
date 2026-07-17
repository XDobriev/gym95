import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';
import { getSummary } from './_lib/queries';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = authenticate(req, res);
  if (!user) return;
  try {
    const summary = await getSummary(user.userId);
    res.status(200).json(summary);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ошибка сервера' });
  }
}
