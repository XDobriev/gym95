import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';
import { getVolumeHistory } from './_lib/queries';
import type { VolumeHistoryResponse } from '../shared/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = authenticate(req, res);
  if (!user) return;

  try {
    const weeks = await getVolumeHistory(user.userId);
    const body: VolumeHistoryResponse = { weeks };
    res.status(200).json(body);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ошибка сервера' });
  }
}
