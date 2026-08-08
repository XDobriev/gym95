import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from '../_lib/auth';
import { validateWorkoutInput } from '../_lib/validateWorkout';
import { updateWorkout, deleteWorkoutForUser } from '../_lib/mutations';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = authenticate(req, res);
  if (!user) return;

  const workoutId = String(req.query.id ?? '');
  if (!workoutId) {
    res.status(400).json({ error: 'Не указан id тренировки' });
    return;
  }

  try {
    if (req.method === 'DELETE') {
      const result = await deleteWorkoutForUser(user.userId, workoutId);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'PUT') {
      const validated = validateWorkoutInput(req.body);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }

      const result = await updateWorkout(user.userId, workoutId, validated.value);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ошибка сервера' });
  }
}
