import crypto from 'node:crypto';
import { config } from '../config';

export interface AuthedUser {
  userId: number;
  firstName: string | null;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Валидация подписи Telegram Mini App initData.
//   secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
//   hash       = HMAC_SHA256(key=secret_key, message=data_check_string)
// data_check_string — все поля кроме hash, отсортированные по ключу, "k=v" через \n.
export function validateInitData(initData: string): AuthedUser {
  if (!initData) {
    throw new AuthError('Пустой initData — открой приложение внутри Telegram');
  }

  const params = new URLSearchParams(initData);
  const providedHash = params.get('hash');
  if (!providedHash) {
    throw new AuthError('В initData нет hash');
  }

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(computedHash, 'hex');
  const b = Buffer.from(providedHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AuthError('Подпись initData не совпала');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new AuthError('В initData нет пользователя');
  }
  const user = JSON.parse(userRaw) as { id: number; first_name?: string };
  if (typeof user.id !== 'number') {
    throw new AuthError('Некорректный id пользователя');
  }

  return { userId: user.id, firstName: user.first_name ?? null };
}
