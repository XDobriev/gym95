import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';

// Reachability-тест: подтверждает, что Mini App грузится, initData валиден
// и функция отвечает. БД не трогает.
export default function handler(req: VercelRequest, res: VercelResponse) {
  const user = authenticate(req, res);
  if (!user) return;
  res.status(200).json({ userId: user.userId, firstName: user.firstName });
}
