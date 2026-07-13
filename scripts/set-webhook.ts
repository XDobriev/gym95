import 'dotenv/config';
import { config } from '../src/config';

async function main() {
  const url = process.argv[2];
  const secret = process.env.WEBHOOK_SECRET;

  if (!url) {
    console.error('Использование: npm run set-webhook -- <url функции>');
    process.exit(1);
  }
  if (!secret) {
    console.error(
      'Отсутствует переменная окружения WEBHOOK_SECRET. Сгенерируйте случайную строку (буквы/цифры/-/_, до 256 символов) и добавьте её в .env — та же строка должна быть задана в переменных окружения функции при деплое.',
    );
    process.exit(1);
  }

  const response = await fetch(`https://api.telegram.org/bot${config.BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ url, secret_token: secret }),
  });
  const result = await response.json();
  console.log(result);
}

main();
