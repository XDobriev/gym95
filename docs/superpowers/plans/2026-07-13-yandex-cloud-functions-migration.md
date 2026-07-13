# Перенос хостинга бота на Yandex Cloud Functions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести хостинг Telegram-бота gym95 с Railway (long polling) на Yandex Cloud Functions (webhook), не трогая базу данных Supabase.

**Architecture:** Логика бота (Telegraf-инстанс + регистрация хендлеров) выносится в общий модуль `src/botInstance.ts`, который переиспользуют два независимых entry point'а: `src/bot.ts` (long polling, локальная разработка) и `src/webhook.ts` (тонкий HTTP-адаптер для Yandex Cloud Functions, вызывает `bot.handleUpdate`). `webhook.ts` бандлится esbuild'ом в один файл и деплоится как публичная (без IAM-авторизации) функция, на которую Telegram шлёт апдейты напрямую — без API Gateway.

**Tech Stack:** Node.js 22, TypeScript, Telegraf 4, esbuild (бандлинг), Yandex Cloud Functions (`yc` CLI), Supabase (без изменений).

Спека: `docs/superpowers/specs/2026-07-13-yandex-cloud-functions-migration-design.md`

---

## Task 1: Вынести Telegraf-инстанс в отдельный модуль

**Files:**
- Create: `src/botInstance.ts`
- Modify: `src/bot.ts`

- [ ] **Step 1: Создать `src/botInstance.ts`**

```ts
import { Telegraf } from 'telegraf';
import { config } from './config';
import { registerStart } from './handlers/start';
import { registerHistory } from './handlers/history';
import { registerProgress } from './handlers/progress';
import { registerExport } from './handlers/export';
import { registerWorkout } from './handlers/workout';

export const bot = new Telegraf(config.BOT_TOKEN);

registerStart(bot);
registerWorkout(bot);
registerHistory(bot);
registerProgress(bot);
registerExport(bot);

bot.catch((err, ctx) => {
  console.error(`Ошибка обработки апдейта ${ctx.updateType}:`, err);
});
```

- [ ] **Step 2: Заменить содержимое `src/bot.ts`**

```ts
import { bot } from './botInstance';

// bot.launch() резолвится только когда бот остановлен (long polling блокирует promise
// до вызова bot.stop()), поэтому подтверждение старта делаем через onLaunch-колбэк.
bot.launch(() => {
  console.log(`gym95 bot запущен (long polling) как @${bot.botInfo?.username}`);
}).catch((err) => {
  console.error('Не удалось запустить бота:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

- [ ] **Step 3: Проверить компиляцию**

Run: `npm run build`
Expected: команда завершается без ошибок TypeScript; в `dist/` появляются `bot.js` и `botInstance.js`.

- [ ] **Step 4: Commit**

```bash
git add src/botInstance.ts src/bot.ts
git commit -m "refactor: extract shared Telegraf instance into botInstance.ts"
```

---

## Task 2: Добавить webhook-обработчик для Yandex Cloud Functions

**Files:**
- Create: `src/webhook.ts`

- [ ] **Step 1: Создать `src/webhook.ts`**

```ts
import { bot } from './botInstance';

interface YandexHttpEvent {
  body: string;
}

export const handler = async (event: YandexHttpEvent, _context: unknown) => {
  try {
    const update = JSON.parse(event.body);
    await bot.handleUpdate(update);
  } catch (err) {
    console.error('Ошибка обработки вебхук-апдейта:', err);
  }

  // Всегда 200, иначе Telegram будет бесконечно ретраить недоставленный апдейт.
  return { statusCode: 200, body: '' };
};
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npm run build`
Expected: команда завершается без ошибок TypeScript; в `dist/` появляется `webhook.js`.

- [ ] **Step 3: Commit**

```bash
git add src/webhook.ts
git commit -m "feat: add Yandex Cloud Functions webhook handler"
```

---

## Task 3: Бандлинг функции под деплой (esbuild)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Добавить `esbuild` в `devDependencies`**

В `package.json`, в блок `"devDependencies"` (после `"@types/node"`) добавить:

```json
    "esbuild": "^0.28.1",
```

- [ ] **Step 2: Добавить скрипт бандлинга**

В `package.json`, в блок `"scripts"` добавить:

```json
    "build:webhook": "esbuild src/webhook.ts --bundle --platform=node --target=node22 --outfile=dist/webhook-bundle.js --minify",
```

- [ ] **Step 3: Установить зависимости**

Run: `npm install`
Expected: завершается без ошибок, `esbuild` зафиксирован в `package-lock.json`.

- [ ] **Step 4: Проверить бандлинг**

Run: `npm run build:webhook`
Expected: команда завершается без ошибок; создаётся файл `dist/webhook-bundle.js` (один файл, включающий telegraf и supabase-js).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add esbuild bundling script for Yandex Cloud Function package"
```

---

## Task 4: Скрипt для одноразовой настройки вебхука

**Files:**
- Create: `scripts/set-webhook.ts`

- [ ] **Step 1: Создать `scripts/set-webhook.ts`**

```ts
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
```

- [ ] **Step 2: Добавить npm-скрипт**

В `package.json`, в блок `"scripts"` добавить:

```json
    "set-webhook": "tsx scripts/set-webhook.ts",
```

- [ ] **Step 3: Проверить, что скрипт запускается**

Run: `npm run set-webhook`
Expected: скрипт печатает `Использование: npm run set-webhook -- <url функции>` и завершается с кодом 1 (запущен без аргумента URL — это ожидаемо на этом шаге, реальный вызов с URL будет в Task 6 после деплоя).

- [ ] **Step 4: Commit**

```bash
git add scripts/set-webhook.ts package.json
git commit -m "feat: add one-off script to configure Telegram webhook"
```

---

## Task 5: Убрать конфигурацию Railway

**Files:**
- Delete: `railway.json`
- Delete: `Procfile`

- [ ] **Step 1: Удалить файлы**

```bash
git rm railway.json Procfile
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove Railway deployment config"
```

---

## Task 6: Обновить README под новый деплой

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Заменить раздел "Деплой на Railway" на инструкцию по Yandex Cloud Functions**

В `README.md` заменить блок (строки со слов `## Деплой на Railway` и до конца файла) на:

```markdown
## Деплой на Yandex Cloud Functions

Требуется установленный и авторизованный [`yc` CLI](https://yandex.cloud/ru/docs/cli/quickstart).

1. Собрать бандл функции:
   ```
   npm run build:webhook
   ```
2. Упаковать в zip (PowerShell):
   ```
   Compress-Archive -Path dist/webhook-bundle.js -DestinationPath function.zip -Force
   ```
   Внутри архива файл должен называться `webhook-bundle.js` — это важно для entrypoint ниже.
3. Создать функцию (один раз):
   ```
   yc serverless function create --name=gym95-bot
   ```
4. Опубликовать новую версию с переменными окружения:
   ```
   yc serverless function version create `
     --function-name=gym95-bot `
     --runtime=nodejs22 `
     --entrypoint=webhook-bundle.handler `
     --memory=128m `
     --execution-timeout=10s `
     --source-path=function.zip `
     --environment BOT_TOKEN=<токен>,SUPABASE_URL=<url>,SUPABASE_KEY=<key>
   ```
5. Разрешить вызов без IAM-авторизации (иначе Telegram не сможет достучаться):
   ```
   yc serverless function allow-unauthenticated-invoke gym95-bot
   ```
6. Узнать публичный URL функции:
   ```
   yc serverless function get gym95-bot
   ```
   URL имеет вид `https://functions.yandexcloud.net/<id>`.
7. Настроить вебхук в Telegram:
   ```
   npm run set-webhook -- https://functions.yandexcloud.net/<id>
   ```
8. Проверить, что вебхук принят: открыть в браузере
   `https://api.telegram.org/bot<токен>/getWebhookInfo` — поле `url` должно совпадать с URL функции, `last_error_message` — отсутствовать.

При обновлении кода: повторить шаги 1–2, затем `yc serverless function version create` (шаг 4) — новая версия автоматически станет активной.

## Локальная разработка

Локально бот по-прежнему работает через long polling — см. раздел "Локальный запуск" выше (`npm run dev`), ngrok не нужен.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document Yandex Cloud Functions deployment"
```

---

## Task 7: Деплой и сквозная проверка (выполняется вручную, не агентом)

Эта задача требует авторизованного `yc` CLI с вашим аккаунтом Yandex Cloud и реального обращения к Telegram Bot API — её должен выполнить пользователь, а не автоматический воркер.

- [ ] **Step 1:** Выполнить шаги 1–8 из раздела "Деплой на Yandex Cloud Functions" в `README.md`, подставив реальные `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`.
- [ ] **Step 2:** Отправить боту `/start` в Telegram, убедиться, что приходит приветствие.
- [ ] **Step 3:** Пройти полный сценарий `/new_workout` → добавить упражнение с подходами → `/done`, убедиться, что тренировка сохраняется.
- [ ] **Step 4:** Выполнить `/history`, `/progress <упражнение>`, `/export`, убедиться, что данные, сохранённые на шаге 3, там видны.
- [ ] **Step 5:** Проверить логи функции в консоли Yandex Cloud (Cloud Functions → gym95-bot → Логи) — не должно быть необработанных исключений.
- [ ] **Step 6:** Убедиться, что процесс на Railway остановлен/удалён, чтобы не было двух ботов, отвечающих на одни и те же сообщения одновременно.

---

## Self-Review

- Все пункты спеки (`2026-07-13-yandex-cloud-functions-migration-design.md`) покрыты: архитектура прямого HTTP-триггера — Task 2, 6; вынос `botInstance.ts` — Task 1; конфиг/секреты через env — Task 6 шаг 4; esbuild-бандлинг — Task 3; удаление Railway-конфигов — Task 5; разовая настройка вебхука — Task 4, 7; ручной тест-план — Task 7.
- Плейсхолдеров нет: единственные `<токен>`/`<url>`/`<key>`/`<id>` — это места, куда пользователь подставляет свои реальные секреты и ID при выполнении команд (не "TBD" для агента).
- Сигнатуры согласованы: `bot` экспортируется из `botInstance.ts` (Task 1) и используется без изменений в `bot.ts` (Task 1) и `webhook.ts` (Task 2); `handler` в `webhook.ts` соответствует entrypoint `webhook-bundle.handler` в Task 6 (после бандлинга esbuild имя файла — `webhook-bundle.js`, экспорт — `handler`).
