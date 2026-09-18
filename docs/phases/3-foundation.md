---
id: '3'
status: todo
sync_state: drifted
last_reviewed: 2026-05-26
status_note: 'Стартовая фаза нового стека. 8 эпиков, 22 задачи. Чистый foundation без бизнес-логики.'
estimated_hours: '30-40'
depends_on: []
---

# Phase 3: Foundation

**Цель.** Заложить технический фундамент платформы Volley Time: монорепозиторий с pnpm + Turborepo, Drizzle schema с базовыми моделями (User, Account), better-auth с email-code (dev: console) + Telegram identity, скелеты apps/web (Nuxt 4) и apps/bot (grammY), Docker dev environment, Vitest, GitHub Actions CI.

## Контекст

Это **первая фаза нового стека**. До неё — только документация и legacy Python-код. После Phase 3 в репозитории есть рабочий монорепо, можно `pnpm dev` и зарегистрироваться через email-код (код приходит в console.log) или войти из Telegram.

**Никакой бизнес-логики в этой фазе.** Organizations, Events, Bookings — это Phase 4-5. Сейчас только фундамент.

## Предусловия

- ✅ Понимание видения и архитектуры (PLATFORM_VISION.md, ARCHITECTURE.md, STACK_DECISIONS.md)
- ✅ Доступ к репозиторию (приватный GitHub)
- Установлены локально:
  - Node.js 20+ (рекомендуется через `nvm` или `fnm`)
  - pnpm 9+ (`npm install -g pnpm` или `corepack enable`)
  - Docker Desktop (для PostgreSQL и Redis)
  - Git
- Создан Telegram бот через [@BotFather](https://t.me/BotFather):
  - Имя: `@volleytime_bot` (или `@volleytime_dev_bot` для dev)
  - Получен `TELEGRAM_BOT_TOKEN`
- (опционально) Зарегистрирован домен `volleytime.by` — нужен только в Phase 9, но можно купить заранее

## Definition of Done

После выполнения всех 22 задач Phase 3:

1. ✅ `pnpm install` ставит все зависимости в монорепо без ошибок
2. ✅ `pnpm dev` поднимает: PostgreSQL + Redis + Nuxt app + Telegram bot — всё одной командой
3. ✅ Можно открыть `http://localhost:3000` и увидеть стартовую страницу
4. ✅ Можно нажать «Зарегистрироваться по email» → ввести email → получить 6-значный код в console.log → подтвердить → быть авторизованным
5. ✅ Можно нажать `/start` в Telegram-боте → получить deeplink на Mini App → открыть Mini App → быть авторизованным через `initData`
6. ✅ Связывание email + Telegram identity работает: можно из веб-сессии привязать Telegram, и наоборот
7. ✅ `pnpm test` запускает unit-тесты, все проходят
8. ✅ `pnpm test:integration` запускает интеграционные тесты с PostgreSQL, все проходят
9. ✅ `pnpm typecheck` проходит без ошибок (strict mode)
10. ✅ `pnpm lint` проходит без ошибок (ESLint flat config + Prettier)
11. ✅ GitHub Actions CI зелёный на push (typecheck + lint + test)
12. ✅ Drizzle миграции применяются (`pnpm db:migrate`) и откатываются (`pnpm db:rollback`)
13. ✅ README обновлён с инструкциями локального запуска
14. ✅ Документация Phase 3 обновлена: статусы задач done, sync_state aligned

## Архитектура Phase 3

```
volley_time_platform/
├── apps/
│   ├── web/                      # Nuxt 4 app
│   │   ├── nuxt.config.ts
│   │   ├── app.vue
│   │   ├── pages/
│   │   │   ├── index.vue         # стартовая страница
│   │   │   ├── login.vue         # вход через email-code
│   │   │   └── m/                # Mini App routes
│   │   │       └── index.vue
│   │   ├── server/
│   │   │   ├── api/
│   │   │   │   └── auth/         # better-auth handler
│   │   │   └── middleware/
│   │   └── package.json
│   │
│   └── bot/                      # grammY bot
│       ├── src/
│       │   ├── index.ts
│       │   ├── handlers/
│       │   │   └── start.ts
│       │   └── client.ts
│       └── package.json
│
├── packages/
│   ├── db/                       # Drizzle schema + миграции
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── user.ts       # User + Account (для better-auth)
│   │   │   │   └── index.ts
│   │   │   ├── client.ts
│   │   │   └── index.ts
│   │   ├── migrations/
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── auth/                     # better-auth setup
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── email-code.ts
│   │   │   └── telegram.ts
│   │   └── package.json
│   │
│   └── shared/                   # общие типы и утилиты
│       ├── src/
│       │   ├── types/
│       │   ├── time.ts
│       │   └── index.ts
│       └── package.json
│
├── docker-compose.yml            # dev: postgres + redis
├── turbo.json                    # Turborepo config
├── pnpm-workspace.yaml
├── package.json                  # root scripts
├── tsconfig.base.json
├── eslint.config.js              # flat config
├── .prettierrc.json
└── .github/workflows/ci.yml
```

## Эпики

| ID                                     | Эпик                                               | Задач | Часов |
| -------------------------------------- | -------------------------------------------------- | ----: | ----: |
| [3.1](../epics/3-1-monorepo-init.md)   | Monorepo init (pnpm + Turborepo + TS strict)       |     3 |   4-5 |
| [3.2](../epics/3-2-drizzle-schema.md)  | packages/db: Drizzle schema + миграции             |     3 |   5-6 |
| [3.3](../epics/3-3-better-auth.md)     | packages/auth: better-auth + email-code + Telegram |     4 |   6-8 |
| [3.4](../epics/3-4-nuxt-skeleton.md)   | apps/web: Nuxt 4 скелет + auth UI                  |     3 |   5-6 |
| [3.5](../epics/3-5-grammy-skeleton.md) | apps/bot: grammY скелет + /start handler           |     2 |   3-4 |
| [3.6](../epics/3-6-docker-dev.md)      | Docker dev environment                             |     2 |   2-3 |
| [3.7](../epics/3-7-tests.md)           | Vitest setup + smoke tests                         |     3 |   3-4 |
| [3.8](../epics/3-8-ci.md)              | GitHub Actions CI                                  |     2 |   2-3 |
| [3.9](../epics/3-9-review-fixes.md)    | **Исправления по ревью v0.1.0** (релиз v0.1.1)     |    13 | 18-26 |
| [3.10](../epics/3-10-review2-fixes.md) | **Исправления по повторному ревью v0.1.1**         |     3 |   2-3 |

**Итого:** 8 эпиков, 22 задачи, **30-40 часов** работы.

## Технические заметки

### Утверждённые решения

1. **Monorepo:** pnpm workspaces + Turborepo (для кеширования и параллельных tasks)
2. **TypeScript:** strict mode с первого дня
3. **ESLint:** flat config (eslint.config.js), не legacy `.eslintrc`
4. **Drizzle:** `drizzle-kit generate` для миграций, не `push`
5. **Email в dev:** код пишется в console.log, готовая интеграция Unisender Go активируется только в Phase 9
6. **Identity:** equal — email и Telegram независимо создают аккаунт, можно связать (через better-auth `account` таблицу)
7. **PostgreSQL:** сразу используем PG-features (jsonb, partial indexes) где нужно
8. **Тесты:** Vitest для unit, отдельный `pnpm test:integration` с локальным PG (другая БД), в CI — PG service container
9. **CI:** typecheck + lint + test на каждый push (Docker build НЕ в Phase 3 — это Phase 9)

### Что НЕ делаем в Phase 3

- ❌ Никакой бизнес-логики (Organization, Event, Booking — Phase 4+)
- ❌ Никакого Mini App layout (только базовая страница `m/index.vue` с auth)
- ❌ Никаких уведомлений из бота
- ❌ Никаких UI-библиотек кроме базового Tailwind setup
- ❌ Никаких production-конфигов (Caddyfile, prod docker-compose — Phase 9)
- ❌ Никакого email-провайдера (только console.log)
- ❌ Не подключаем Sentry (Phase 9)

### Стек подтверждаем в Phase 3

После Phase 3 стек считается зафиксированным:

- Nuxt 4 (текущая стабильная версия)
- Drizzle ORM (latest)
- better-auth — **проверяется в эпике 3.3.** Если возникнут проблемы с Telegram identity → fallback на Lucia (это решается **в момент эпика 3.3**, не сейчас).
- grammY (latest)
- PostgreSQL 16+
- Redis 7+ (для better-auth sessions)

### Ссылки

- [STACK_DECISIONS.md](../architecture/STACK_DECISIONS.md) — обоснование выбора
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — общая архитектура
- [MODULITH_ARCHITECTURE.md](../architecture/MODULITH_ARCHITECTURE.md) — устройство модулей
- [DOMAIN.md](../DOMAIN.md) — что строим начиная с Phase 4
