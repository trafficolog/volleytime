# 🏐 Volley Time

[![CI](https://github.com/trafficolog/volleytime/actions/workflows/ci.yml/badge.svg)](https://github.com/trafficolog/volleytime/actions/workflows/ci.yml)

**Telegram-first платформа для организации любительских спортивных событий.**

Платформа помогает организаторам тренировок, открытых игр, клубов и соревнований управлять записями, абонементами, оплатами, сборами, расписаниями и (в будущем) турнирами — всё в одном месте через Telegram Mini App + веб-приложение.

**Домен:** [volleytime.by](https://volleytime.by) (production)
**Хостинг:** Российский VPS (см. [docs/guides/DEPLOY.md](./docs/guides/DEPLOY.md))

> При расширении платформы на другие виды спорта планируется ребрендинг в общую марку — **ВТЕМПЕ** (vtempe.by / vtempe.ru). Решение принимается после Phase 10 (Private Beta).

---

## Позиционирование

Volley Time — это **не публичный SaaS-маркетплейс**. Это инструмент для организаторов, который:

- **Не становится платёжным посредником** между игроком и организатором на старте.
- **Не диктует, как принимать деньги** — наличные, переводы, и в будущем онлайн-оплата как опциональный модуль.
- **Не пытается быть всем сразу** — начинает с одной группы / клуба, потом расширяется до private beta, потом до полноценного SaaS.

Платформа продаёт **инструмент** организатору (event credits, подписка), а оплата игрока за тренировку остаётся между игроком и организатором.

---

## Быстрый старт (разработка)

Требуется Node ≥ 22, Docker.

```bash
./scripts/setup.sh        # pnpm install, .env, postgres, миграции dev+test
pnpm dev                  # web :3000 + bot (polling)
pnpm test                 # unit + integration (нужен Postgres)
pnpm test:unit            # без БД
pnpm test:integration     # db / core / auth на Postgres
pnpm typecheck && pnpm lint
pnpm db:rollback          # откат последней миграции (нужен rollback/<tag>.sql)
```

---

## Стек

| Слой               | Технология                                                       |
| ------------------ | ---------------------------------------------------------------- |
| Frontend / Backend | Nuxt 4 (full-stack, Nitro server routes)                         |
| ORM                | Drizzle                                                          |
| База данных        | PostgreSQL                                                       |
| Auth               | better-auth (email-code passwordless + Telegram identity)        |
| Telegram Bot       | grammY (TypeScript)                                              |
| Telegram Mini App  | Nuxt 4 (тот же фронтенд, адаптированный под Telegram WebApp API) |
| Деплой             | Docker + Caddy (HTTPS)                                           |
| Тесты              | Vitest                                                           |

Полное обоснование выбора — в [docs/architecture/STACK_DECISIONS.md](./docs/architecture/STACK_DECISIONS.md).

---

## Что уже работает

Эта итерация проекта — **новый старт**. Существуют два предшественника, которые используются как референсы и domain knowledge:

### Legacy 1: Python-прототип (`legacy/python-prototype/`)

Telegram-бот на Python/aiogram/SQLAlchemy с реализованными:

- запись на тренировки с распределением слотов (main / rotation / waitlist)
- абонементы (4 / 8 / 12 сессий)
- ручные оплаты с подтверждением админом
- касса (ledger)
- отметка посещаемости
- отмена тренировки с refund-логикой
- 25 проходящих тестов

Этот прототип будет запущен в реальной группе на пару месяцев параллельно с разработкой новой платформы — для проверки гипотез и сбора реального UX-фидбэка.

### Legacy 2: Level Volley (Laravel)

Полноценная веб-платформа для турниров с реализованными:

- email-code auth (passwordless)
- события / команды / матчи / sets
- судейские сессии с live scoring
- append-only журнал с optimistic locking
- live scoreboard (auto-refresh)
- MVP-голосование
- турнирная таблица (standings) с настраиваемой системой очков
- роли: player → judge → organizer → admin
- запросы на повышение роли
- audit log
- публичная страница события с QR-кодом

Этот проект **остаётся в продакшене** и будет переписан на новый стек только **после подтверждения гипотез** по основному ядру (бронирования + абонементы + Telegram Mini App).

---

## Структура репозитория

```
volley_time_platform/
├── README.md                # Этот файл
├── docs/                    # Документация (полностью на русском)
│   ├── PLATFORM_VISION.md
│   ├── MIGRATION_STRATEGY.md
│   ├── ROADMAP.md
│   ├── DOMAIN.md
│   ├── strategy/
│   │   ├── SAAS_STRATEGY.md
│   │   ├── BILLING_AND_ENTITLEMENTS.md
│   │   ├── INVITES_AND_MEMBERSHIP.md
│   │   ├── CONTRIBUTIONS.md
│   │   ├── ORGANIZER_MONETIZATION.md
│   │   └── PRIVATE_BETA_PLAN.md
│   ├── architecture/
│   │   ├── ARCHITECTURE.md
│   │   ├── MODULITH_ARCHITECTURE.md
│   │   └── STACK_DECISIONS.md
│   ├── phases/              # phases/{N}-{slug}.md
│   ├── guides/              # TAXES_BY, BEPAID, DEPLOY и т.д.
│   └── operations/          # sessions/, iterations/, status/, templates/
│
├── legacy/                  # Архив предшествующих версий
│   ├── python-prototype/    # Telegram-бот на Python (Phase 1+2)
│   └── level-volley-laravel/  # Laravel-приложение (будет добавлено)
│
├── apps/                    # (будет создано в Phase 3)
│   ├── web/                 # Nuxt 4 app
│   └── bot/                 # grammY bot
│
├── packages/                # (будет создано в Phase 3)
│   └── db/                  # Drizzle schema, миграции
│
└── docker-compose.yml       # (Phase 9)
```

---

## С чего начать

- **Понять видение:** [docs/PLATFORM_VISION.md](./docs/PLATFORM_VISION.md)
- **Что и зачем переписываем:** [docs/MIGRATION_STRATEGY.md](./docs/MIGRATION_STRATEGY.md)
- **Roadmap:** [docs/ROADMAP.md](./docs/ROADMAP.md)
- **Релиз-план:** [docs/RELEASES.md](./docs/RELEASES.md) · **GitHub-ведение:** [docs/GITHUB_SETUP.md](./docs/GITHUB_SETUP.md)
- **Domain model:** [docs/DOMAIN.md](./docs/DOMAIN.md)
- **Архитектура:** [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md)
- **Стратегия SaaS:** [docs/strategy/SAAS_STRATEGY.md](./docs/strategy/SAAS_STRATEGY.md)

## Текущий статус

**Release candidate: `v0.1.3` (подготовка релиза).** Основные R0/MVP-потоки фаз 3, 4, 5, 6, 8 и 9 реализованы. `v0.1.1` закрыл 21 P0 первого аудита, `v0.1.2` — 4 P1 и 5 P2 повторного ревью. Fresh GitHub CI зелёный; SDD reconciliation сократил исторический drift с 119 до 18 реально открытых cards. Production/manual gates остаются незакрытыми.

Что уже подтверждено на уровне репозитория:

- организация, участники, приглашения, роли и tenant isolation;
- события, бронирование, waitlist, посещаемость и отмены;
- абонементы, ручные оплаты и ledger;
- Telegram initData auth, bot notifications и Mini App;
- Docker/Caddy, webhook, миграционная стадия, smoke и rollback workflow;
- два предыдущих code review с закрытыми repository-level P0/P1/P2.

Что **ещё не считается закрытым** до реального production-подтверждения:

1. ручной QA в настоящем Telegram по `docs/operations/qa/telegram-miniapp-checklist.md`;
2. первый VPS deploy по `docs/guides/DEPLOY.md` и успешный production smoke;
3. реальный backup/restore + внешний мониторинг;
4. критерий R0: неделя реальных тренировок только через продукт.

Поэтому текущий корректный статус — **release candidate с незакрытыми SDD/production gates**, а не доказанный production MVP. Phase 10+ остаётся вне этого релиза.

См. [актуальный snapshot](./docs/operations/status/current-state.md), [релиз-план](./docs/RELEASES.md) и [release-readiness review](./docs/operations/reviews/2026-09-18-v0.1.2-release-readiness.md).
