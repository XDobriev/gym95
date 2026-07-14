# gym95 — дневник тренировок

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)
![Telegraf](https://img.shields.io/badge/Telegraf-4.16-26A5E4?logo=telegram&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render.com-46E3B7?logo=render&logoColor=white)

Личный Telegram-бот для ведения дневника тренировок. Node.js + TypeScript, Telegraf, Supabase (Postgres), деплой на Render.com (long polling, бесплатный тариф).

## Функционал

- `/start` — приветствие и список команд
- `/new_workout` — запись тренировки через inline-кнопки:
  - **силовая** — выбор упражнения из справочника по группам мышц (грудь, спина, ноги, плечи, руки, пресс) или своё название, ввод подходов одной строкой (`40x12, 40x12, 42.5x10`)
  - **кардио** — бег, ходьба, велосипед, дорожка: длительность, дистанция, уклон, средний пульс
  - **бассейн** — отдельный тип тренировки со своими параметрами
  - **смешанная** — силовая + кардио/бассейн в одной тренировке
- `/done` — завершить и сохранить текущую тренировку
- `/history` — последние тренировки с пагинацией
- `/progress <упражнение>` — история весов/повторений по упражнению
- `/export` — вся история в markdown (для вставки в LLM-чат)
- `/settings` — вкл/выкл напоминаний и время ежедневной проверки (ЧЧ:ММ, Europe/Moscow)

Напоминания: если у пользователя включены напоминания в `/settings`, фоновая cron-джоба
(`src/cron/reminders.ts`, тикает раз в минуту в процессе `bot.ts`) раз в день, в выбранное
пользователем время (по Europe/Moscow), проверяет — не было ли тренировки ≥2 дней — и,
если да, присылает одно напоминание в день.

## Локальный запуск

1. Создать тестового бота через [@BotFather](https://t.me/BotFather), получить токен.
2. Создать проект в [Supabase](https://supabase.com), выполнить `migrations/schema.sql` через SQL Editor.
3. Скопировать `.env.example` в `.env` и заполнить `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY` (service role key).
4. `npm install`
5. `npm run dev` — запуск с автоперезагрузкой (long polling, ngrok не нужен).

## Локальный запуск без авто-перезагрузки

Скомпилировать и запустить бота через long polling без `tsx watch` (например, чтобы проверить собранный `dist/` перед деплоем):

```
npm run build
npm run start
```

## Деплой на Render.com (текущий способ)

Бесплатный тариф, карта не нужна. Бот работает через long polling (как локально), HTTP-сервер в `src/bot.ts` слушает `$PORT` только для health-check — сам он ничего не обрабатывает.

1. Зарегистрироваться на [render.com](https://render.com) (можно через GitHub, без карты) и подключить репозиторий `gym95`.
2. Создать **Web Service** (не Static Site и не Background Worker — только Web Service доступен на бесплатном тарифе с постоянным аптаймом при пинге):
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
3. В Environment добавить `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY` (те же значения, что и в `.env`). `WEBHOOK_SECRET` и переменные для Yandex Cloud не нужны — вебхук не используется.
4. После первого деплоя скопировать публичный URL сервиса (вида `https://gym95-bot.onrender.com`).
5. Настроить бесплатный внешний пинг на `<url>/` каждые 10–14 минут (например, [UptimeRobot](https://uptimerobot.com), регистрация без карты) — иначе Render усыпит сервис через 15 минут простоя по HTTP. Сам бот при этом продолжит работать, пока Render не усыпил контейнер, а пинг просто поддерживает контейнер живым.
6. Проверить, что вебхук в Telegram снят (иначе бот не будет получать апдейты через long polling):
   ```
   curl "https://api.telegram.org/bot<токен>/deleteWebhook"
   ```

**Почему не Yandex Cloud Functions:** изначально бот был перенесён на Yandex Cloud Functions (webhook), но в июле 2026 обнаружилось, что РКН блокирует именно входящие соединения от серверов Telegram к российской инфраструктуре — Telegram стабильно получал `Connection timed out` при попытке доставить апдейты на функцию, хотя сама функция была настроена и работала корректно (проверено прямыми запросами). Код вебхука (`src/webhook.ts`, `scripts/set-webhook.ts`) оставлен в репозитории на случай, если ситуация с блокировками изменится или появится need в хостинге вне РФ с поддержкой webhook.

## Архивный способ: деплой на Yandex Cloud Functions

⚠️ Не работает из РФ по сети (см. причину выше) — оставлено как справочный материал.

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
4. Сгенерировать секрет для проверки подлинности вебхук-запросов и сохранить его в `.env` как `WEBHOOK_SECRET` (PowerShell):
   ```
   [guid]::NewGuid().ToString("N")
   ```
   Скопируйте вывод в `WEBHOOK_SECRET` в `.env` — та же строка понадобится на следующем шаге и в шаге настройки вебхука.
5. Опубликовать новую версию с переменными окружения:
   ```
   yc serverless function version create `
     --function-name=gym95-bot `
     --runtime=nodejs22 `
     --entrypoint=webhook-bundle.handler `
     --memory=128m `
     --execution-timeout=10s `
     --source-path=function.zip `
     --environment BOT_TOKEN=<токен>,SUPABASE_URL=<url>,SUPABASE_KEY=<key>,NODE_OPTIONS=--enable-source-maps,WEBHOOK_SECRET=<секрет>
   ```
   `NODE_OPTIONS=--enable-source-maps` включает символизацию стек-трейсов по инлайновому source map, зашитому в бандл esbuild'ом — без этого ошибки в логах будут указывать на минифицированный код.
6. Разрешить вызов без IAM-авторизации (иначе Telegram не сможет достучаться):
   ```
   yc serverless function allow-unauthenticated-invoke gym95-bot
   ```
7. Узнать публичный URL функции:
   ```
   yc serverless function get gym95-bot
   ```
   URL имеет вид `https://functions.yandexcloud.net/<id>`.
8. Настроить вебхук в Telegram:
   ```
   npm run set-webhook -- https://functions.yandexcloud.net/<id>
   ```
9. Проверить, что вебхук принят: открыть в браузере
   `https://api.telegram.org/bot<токен>/getWebhookInfo` — поле `url` должно совпадать с URL функции, `last_error_message` — отсутствовать.

При обновлении кода: повторить шаги 1–2, затем `yc serverless function version create` (шаг 5) — новая версия автоматически станет активной.

## Локальная разработка

Локально бот по-прежнему работает через long polling — см. раздел "Локальный запуск" выше (`npm run dev`), ngrok не нужен.
