# Деплой Mini App «Дневник» (Vercel)

Mini App живёт в папке `webapp/` того же репозитория. Бот на Render не трогается —
он продолжает polling и пишет в Supabase, а Mini App только читает ту же БД.

Архитектура:

```
Telegram-клиент → Mini App (Vercel: статика Vite/React)
                       │  fetch, initData в заголовке X-Telegram-Init-Data
                       ▼
                  Vercel serverless API (webapp/api/*)
                       │  1) валидирует initData (HMAC-SHA256 по BOT_TOKEN)
                       │  2) достаёт userId из подписи, читает Supabase (read-only)
                       ▼
                  Supabase (та же БД, что у бота на Render)
```

## Шаги (делаются один раз)

### 1. Создать проект на Vercel

1. Зайти на <https://vercel.com> (вход через GitHub — карта не нужна, RU-доступ есть).
2. **Add New → Project** → импортировать репозиторий `XDobriev/gym95`.
3. В настройках проекта **обязательно** задать **Root Directory = `webapp`**.
   Framework определится как Vite автоматически (build `npm run build`, output `dist`).

### 2. Задать переменные окружения проекта Vercel

Те же значения, что у бота на Render (Project → Settings → Environment Variables):

| Переменная      | Значение                                  |
| --------------- | ----------------------------------------- |
| `BOT_TOKEN`     | токен @gym95_bot (как на Render)          |
| `SUPABASE_URL`  | `https://slbdktpqmslbxbqlnoge.supabase.co`|
| `SUPABASE_KEY`  | тот же ключ, что на Render                 |

> Совет по прошлым граблям: значения вводить реальными нажатиями клавиш, потом
> перезагрузить страницу и проверить, что они сохранились (баг маскированных полей).

### 3. Задеплоить и получить URL

Deploy → получится адрес вида `https://gym95-xxxx.vercel.app`.

### 4. Проверить доступность из RU (главный тест)

Открыть `https://<твой-домен>.vercel.app/api/hello` в обычном браузере на телефоне
в своей сети. Ожидаемо вернётся `401` c текстом про initData — **это успех**: значит
Vercel доступен и функция отвечает (401 только потому, что нет подписи Telegram).
Если страница вообще не открывается — Vercel недоступен из сети, пиши, придумаем
запасной хост (Cloudflare Pages).

### 5. Подключить Mini App к боту

Добавить на Render (Environment) переменную:

```
WEBAPP_URL=https://<твой-домен>.vercel.app
```

После рестарта бот сам установит menu-кнопку «Дневник» и включит команду `/app`.
Альтернатива для menu-кнопки — вручную в @BotFather: `/mybots → gym95_bot → Bot Settings
→ Menu Button → указать тот же URL`.

### 6. Финальная проверка

Открыть бота в Telegram → нажать «Дневник» (или `/app`) → должны появиться
история тренировок и графики прогресса.

## Локальная разработка

```
cd webapp
npm install
npm run dev        # http://localhost:5173 — вне Telegram API вернёт 401,
                   # экран покажет «Открой через Telegram» (это нормально)
```

Полная проверка initData возможна только внутри Telegram (нужна реальная подпись).

## Заметки

- initData валидируется по подписи (`webapp/api/_lib/auth.ts`) — API никогда не
  доверяет userId из тела/квери, только из проверенной подписи.
- Границы v1: только просмотр. Запись/редактирование тренировок остаются в боте
  (v2 — после подтверждения, что связка Vercel↔Supabase↔Telegram работает из RU).
```
