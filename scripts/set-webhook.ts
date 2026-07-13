import 'dotenv/config';
import { config } from '../src/config';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Использование: npm run set-webhook -- <url функции>');
    process.exit(1);
  }

  const response = await fetch(
    `https://api.telegram.org/bot${config.BOT_TOKEN}/setWebhook?url=${encodeURIComponent(url)}`,
  );
  const result = await response.json();
  console.log(result);
}

main();
