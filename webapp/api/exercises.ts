import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';
import { getExerciseNames } from './_lib/queries';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = authenticate(req, res);
  if (!user) return;
  try {
    const names = await getExerciseNames(user.userId, 100);
    res.status(200).json({ names });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ошибка сервера' });
  }
}
