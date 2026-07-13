# gym95 — дневник тренировок

Личный Telegram-бот для ведения дневника тренировок. Node.js + TypeScript, Telegraf, Supabase (Postgres), деплой на Railway как worker-процесс с long polling (без VPS, без открытого HTTP-порта).

## MVP

- `/start` — приветствие и список команд
- `/new_workout` — пошаговая запись силовой тренировки через inline-кнопки, ввод подходов одной строкой (`40x12, 40x12, 42.5x10`)
- `/done` — завершить и сохранить текущую тренировку
- `/history` — последние тренировки с пагинацией
- `/progress <упражнение>` — история весов/повторений по упражнению
- `/export` — вся история в markdown (для вставки в LLM-чат)

Кардио/бассейн/смешанные тренировки и напоминания — второй этап (см. `railway.json`/структуру `src/handlers/workout/cardioStep.ts` — заготовка).

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

## Деплой на Railway

1. Создать сервис из GitHub-репозитория.
2. Задать переменные окружения (`BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`) в Dashboard → Variables.
3. Домен/порт не привязывать — бот работает через long polling, HTTP не поднимается.
4. `railway.json` уже настроен на `npm install && npm run build` при сборке и `npm run start` при запуске.
