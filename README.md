# dfta — KursWise

Мобильный финансовый помощник: технический анализ валютных пар (USD, EUR, RUB → KZT) + анализ новостного фона → прогноз направления → push-уведомление.

Expo (React Native) → Fastify api + BullMQ worker → Postgres/TimescaleDB + Redis. Бэкенд, воркер, база и кэш живут в Docker, приложение запускается на телефоне и ходит на api по сети.

```
┌─────────────────┐   HTTP    ┌──────────────┐          ┌──────────────────┐
│  Expo-приложение│ ────────► │  api :3000   │ ───────► │  db :5432         │
│   на телефоне   │           │   Fastify    │  Prisma  │  Postgres+        │
└─────────────────┘           └──────────────┘          │  TimescaleDB      │
       твоя машина                   ▲                  └──────────────────┘
                                      │                  ┌──────────────────┐
                             ┌──────────────┐  Prisma    │  redis :6379      │
                             │   worker     │ ─────────► │  BullMQ + кэш     │
                             │  (BullMQ,    │            └──────────────────┘
                             │  раз в 6ч)   │
                             └──────────────┘
                             └──────── docker compose ─────────┘
```

Подробный разбор устройства проекта (что каждый файл делает, путь запроса от кнопки до Postgres, типичные ошибки) — `GUIDE.md`. Целевая архитектура, модель данных и план по этапам — `docs/architecture-roadmap.md`.

## Что нужно поставить

- Docker Desktop
- Node.js 20+ и **npm 10.9** (не 12 — он отключает postinstall-скрипты, на которых держатся Prisma, esbuild и нативные модули RN)
- На телефон — приложение **Expo Go** (App Store / Google Play)

Xcode и Android Studio на старте не нужны.

## Запуск

**Шаг 1. Бэкенд, воркер, база, Redis.** Из корня проекта:

```bash
docker compose up --build
```

Первый раз это займёт пару минут — качаются образы. api сам накатывает миграции (`prisma migrate deploy`) при старте. Готово, когда в логах появится `Server listening at http://0.0.0.0:3000` и `[worker] started, polling every ...`.

Проверь из браузера: <http://localhost:3000/health> — должен вернуться JSON.

Засеять справочник валют и пар (один раз на чистую базу):

```bash
docker compose exec api npm run db:seed
```

**Шаг 2. Приложение.** В другом терминале:

```bash
cd mobile
npm install
npx expo start
```

Сканируешь QR-код камерой (iOS) или из Expo Go (Android). Адрес бэкенда вычисляется автоматически из `Constants.expoConfig.hostUri` (`mobile/src/api.ts`) — вручную ничего не прописывай.

Телефон и компьютер должны быть в одной Wi-Fi сети.

## Что где лежит

```
dfta/
├── compose.yaml            # боевая конфигурация: api + worker + db + redis
├── compose.override.yaml   # локальные надстройки (hot reload), подхватывается сам
├── GUIDE.md                 # подробный разбор устройства проекта
├── docs/
│   ├── architecture-roadmap.md   # целевая архитектура, модель данных, план по этапам
│   ├── financer-design-brief.md  # дизайн-бриф: продукт, дизайн-система, все экраны
│   └── design-handoffs/          # готовые HTML-макеты экранов от дизайна
├── server/
│   ├── Dockerfile           # двухстадийная сборка образа
│   ├── prisma/
│   │   ├── schema.prisma    # currency, currency_pair, candle, indicator_value
│   │   ├── migrations/      # история миграций (prisma migrate dev/deploy)
│   │   └── seed.ts          # сид справочника валют/пар
│   ├── scripts/              # разовые скрипты: сверка FX-провайдеров, экспорт/бэкфилл 2-летнего датасета НБ РК
│   └── src/
│       ├── main.ts           # сборка Fastify-приложения, роуты
│       ├── worker.ts         # BullMQ: опрос котировок раз в 6ч + пересчёт индикаторов
│       └── modules/
│           ├── market/       # IQuoteProvider (НБ РК + ForexRateAPI fallback), роуты /v1/pairs/*
│           └── indicators/   # расчёт EMA/RSI/MACD/Stochastic/ATR/Bollinger по свечам
└── mobile/
    ├── app/                  # экраны, expo-router (app/(tabs), app/pairs/[id])
    └── src/
        ├── api.ts            # вычисление адреса бэкенда + запросы
        ├── components/       # дизайн-система
        └── mock/              # forecast/news/accuracy — ещё моки, бэкенд их не считает
```

## Дизайн

Дизайн-бриф — `docs/financer-design-brief.md`: продукт, аудитория, дизайн-система (цвета, типографика, компоненты), спецификация экранов, юридические и accessibility-требования. Основной источник правды при вёрстке UI.

Готовые макеты конкретных экранов (высокая точность, HTML-референсы, не production-код) — `docs/design-handoffs/`. Открывать `.dc.html`-файлы прямо в браузере, пересоздавать в `mobile/` на Expo/React Native по паттернам, уже принятым в кодовой базе.

## Ежедневные команды

```bash
docker compose up              # поднять
docker compose up --build      # поднять с пересборкой образа (нужно после правки package.json/Dockerfile)
docker compose logs -f api     # логи бэкенда
docker compose logs -f worker  # логи воркера (сбор котировок, индикаторы)
docker compose exec api sh     # зайти внутрь контейнера
docker compose down            # остановить
docker compose down -v         # остановить и стереть данные БД
```

Правки в `server/src/**` подхватываются на лету (`tsx watch`) — пересобирать не надо.

## Работа с базой

Схема — `server/prisma/schema.prisma`. Проект на миграциях (`prisma migrate dev`/`deploy`), не на `db push` — история изменений едет в git и накатывается на всех окружениях одинаково.

После правки схемы (выполняется на хосте, не в контейнере — миграция создаётся локально и монтируется в контейнер через volume):

```bash
cd server
npx prisma migrate dev --name краткое_описание
```

Контейнер `api` сам применит новую миграцию при следующем старте (`migrate deploy` в `compose.override.yaml`).

Посмотреть данные глазами:

```bash
docker compose exec api npx prisma studio
```

Или подключись любым GUI (DBeaver, TablePlus) на `localhost:5432`, пользователь `app`, пароль `secret`.

## Переменные окружения

Секреты и ключи — только в `.env` (в `.gitignore`), никогда в репозитории. Актуальный список — `server/.env.example`:

- `DATABASE_URL` — для Docker уже прописан в `compose.yaml` (хост `db`); `.env` нужен только для запуска сервера напрямую без Docker (тогда хост `localhost`)
- `REDIS_URL` — аналогично, для Docker уже в `compose.yaml`
- `FOREXRATEAPI_KEY` / `UNIRATEAPI_KEY` / `MARKETAUXAPI_KEY` — ключи внешних провайдеров, нужны для `npm run fx:compare`, `fx:export-dataset`, `marketaux:test`
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — LLM-объяснение прогноза (`server/src/modules/forecast/explainer.factory.ts`). Нужен хотя бы один, иначе воркер просто не заполняет `explanation`/`drivers` у прогноза — не обязательны для локального запуска. При обоих заданных выигрывает Gemini — у него постоянный бесплатный тариф (aistudio.google.com), у Anthropic только разовый триал-кредит. Для Docker положи ключ(и) в `.env` **в корне репозитория** (не `server/.env` — тот читают только npm-скрипты вне контейнера), Compose подставит их в `worker` через `compose.yaml`

## Если что-то не работает

**Приложение пишет «Network request failed».** Почти всегда — адрес. Посмотри, какой URL показан под заголовком в приложении, и открой его в браузере телефона. Не открывается — телефон не в той сети, либо файрвол компьютера рубит входящие на 3000.

**`port is already allocated`.** Порт 3000, 5432 или 6379 занят другим процессом. Либо погаси его, либо поменяй левое число в `ports` — например `"3001:3000"`.

**api падает с ошибкой подключения к БД.** Убедись, что в `DATABASE_URL` хост `db`, а не `localhost`. Внутри контейнера localhost — это он сам.

**Поменял package.json, а изменений нет.** Нужна пересборка: `docker compose up --build`.

**Миграция не применилась / дрейф схемы.** Зайди в контейнер и прогони вручную: `docker compose exec api npx prisma migrate deploy`. Если база совсем разъехалась со схемой — см. ядерный вариант ниже.

**Всё сломалось непонятно как.** Ядерный вариант — снести и поднять заново:

```bash
docker compose down -v
docker compose up --build
docker compose exec api npm run db:seed
```

Данные в базе при этом теряются.

## Куда дальше

Текущее состояние и следующие шаги по этапам — см. раздел «Текущее состояние» и «Планы» в `CLAUDE.md`, и план работ целиком — `docs/architecture-roadmap.md` §9.
