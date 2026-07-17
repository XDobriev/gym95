import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';
import { getProgress } from './_lib/queries';
import type { ProgressResponse } from '../shared/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = authenticate(req, res);
  if (!user) return;

  const exercise = String(req.query.exercise ?? '').trim();
  if (!exercise) {
    res.status(400).json({ error: 'Не указано упражнение' });
    return;
  }

  try {
    const points = await getProgress(user.userId, exercise);
    const body: ProgressResponse = { exercise, points };
    res.status(200).json(body);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ошибка сервера' });
  }
}
