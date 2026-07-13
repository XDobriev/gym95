# gym95 — дневник тренировок

Личный Telegram-бот для ведения дневника тренировок. Node.js + TypeScript, Telegraf, Supabase (Postgres), деплой на Yandex Cloud Functions (webhook, без VPS).

## MVP

- `/start` — приветствие и список команд
- `/new_workout` — пошаговая запись силовой тренировки через inline-кнопки, ввод подходов одной строкой (`40x12, 40x12, 42.5x10`)
- `/done` — завершить и сохранить текущую тренировку
- `/history` — последние тренировки с пагинацией
- `/progress <упражнение>` — история весов/повторений по упражнению
- `/export` — вся история в markdown (для вставки в LLM-чат)

Кардио/бассейн/смешанные тренировки и напоминания — второй этап (см. структуру `src/handlers/workout/cardioStep.ts` — заготовка).

## Локальный запуск

1. Создать тестового бота через [@BotFather](https://t.me/BotFather), получить токен.
2. Создать проект в [Supabase](https://supabase.com), выполнить `migrations/schema.sql` через SQL Editor.
3. Скопировать `.env.example` в `.env` и заполнить `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY` (service role key).
4. `npm install`
5. `npm run dev` — запуск с автоперезагрузкой (long polling, ngrok не нужен).

## Сборка и запуск в продакшене

```
npm run build
npm run start
```

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
     --environment BOT_TOKEN=<токен>,SUPABASE_URL=<url>,SUPABASE_KEY=<key>,NODE_OPTIONS=--enable-source-maps
   ```
   `NODE_OPTIONS=--enable-source-maps` включает символизацию стек-трейсов по инлайновому source map, зашитому в бандл esbuild'ом — без этого ошибки в логах будут указывать на минифицированный код.
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
