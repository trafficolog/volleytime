# 🧰 Stack Decisions

> **Last updated:** 2026-05-25
> Обоснование выбора технологий и альтернатив, которые рассматривались и были отвергнуты.

---

## Frontend / Backend: Nuxt 4

### Что выбрано

Nuxt 4 (Vue 3 + Nitro server) — full-stack фреймворк.

### Почему

- **File-based routing** — быстрая навигация в проекте.
- **Server routes (Nitro)** — `server/api/*.ts` даёт нам полноценный backend без отдельного фреймворка.
- **SSR + SPA + Mini App в одном проекте** — Nuxt поддерживает все режимы.
- **Vue 3 Composition API** — приятный DX, легко учить.
- **Богатая экосистема** — модули для аутентификации, i18n, etc.

### Альтернативы и почему НЕ они

| Альтернатива               | Почему отвергнуто                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Next.js 14                 | App Router сложнее в навигации, RSC модель overkill для нашего масштаба, экосистема React менее последовательна |
| SvelteKit                  | Меньше экосистема, меньше готовых решений для Telegram WebApp                                                   |
| Remix                      | Хорош, но Vue приоритетнее по предпочтениям                                                                     |
| Astro                      | Хорош для статики, не подходит для нашего interactive UI                                                        |
| Express + Vue SPA отдельно | Лишнее разделение, потеря преимуществ Nitro                                                                     |

---

## Database: PostgreSQL

### Что выбрано

PostgreSQL 16+.

### Почему

- **Транзакции с изоляцией.**
- **jsonb** для AuditLog, settings, optional fields.
- **Partial indexes** — например, `where status = 'pending'`.
- **Numeric type** для денег.
- **Materialized views** для standings (Phase 16).
- **PostgreSQL-LISTEN/NOTIFY** для real-time (опционально, Phase 16+).
- **Стандарт индустрии**, любой DBA знает.

### Альтернативы и почему НЕ они

| Альтернатива              | Почему отвергнуто                                 |
| ------------------------- | ------------------------------------------------- |
| MySQL                     | Слабее с jsonb, меньше advanced features          |
| SQLite                    | Не для production, нет concurrent writes          |
| MongoDB                   | Транзакции добавили, но всё ещё хуже для финансов |
| CockroachDB / PlanetScale | Overkill, дополнительная сложность                |

---

## ORM: Drizzle

### Что выбрано

Drizzle ORM с PostgreSQL driver (postgres-js).

### Почему

- **TypeScript-first** без code generation.
- **SQL-like API** — близко к ручному SQL, легко читать.
- **Schema-first migrations** через `drizzle-kit`.
- **Лёгкий** — не тянет лишнего.
- **Хорошая поддержка PG-фич** — jsonb, partial indexes, raw SQL escape.

### Альтернативы и почему НЕ они

| Альтернатива            | Почему отвергнуто                                                          |
| ----------------------- | -------------------------------------------------------------------------- |
| Prisma                  | Code generation замедляет dev cycle, лимиты с raw SQL и сложными запросами |
| TypeORM                 | Decorator-style устарел, плохая TypeScript-интеграция                      |
| Kysely                  | Без миграций (нужен drizzle-kit или sql-files отдельно), меньше DX         |
| Raw SQL via postgres-js | Нет типобезопасности                                                       |

### Альтернатива в запасе

Если в Phase 5+ Drizzle упрётся в ограничения (нестандартные запросы для standings, например) — можно использовать raw SQL через postgres-js для конкретных queries. Drizzle позволяет это смешивать.

---

## Auth: better-auth

### Что выбрано

[better-auth](https://better-auth.com) — TypeScript-first библиотека.

### Почему

- **Email-code provider** из коробки (наш основной flow).
- **Custom providers** легко добавлять (для Telegram identity).
- **Sessions через Redis или БД** — выбор по нагрузке.
- **TypeScript-first** — типы из коробки.
- **Active maintenance** на момент 2026-05.

### Альтернативы и почему НЕ они

| Альтернатива       | Почему отвергнуто                                              |
| ------------------ | -------------------------------------------------------------- |
| Auth.js (NextAuth) | Сильно завязан на Next.js, для Nuxt — adapter не первоклассный |
| Lucia              | Auth library, не auth solution — придётся писать много самим   |
| Своя реализация    | Дольше, выше риск багов в безопасности                         |

### Fallback

Если в Phase 3 better-auth не подойдёт (issue с Telegram identity link, или с rate limiting) — переходим на **Lucia v3** с кастомной email-code стратегией. Это решение Phase 3, не сейчас.

---

## Telegram Bot: grammY

### Что выбрано

[grammY](https://grammy.dev) — TypeScript-first библиотека для Telegram Bot API.

### Почему

- **Современная TypeScript-first библиотека.**
- **Полная поддержка Telegram Bot API** (включая WebApp).
- **Inline keyboards, callback queries, FSM (через session middleware).**
- **Активная разработка.**
- **Хорошая документация.**

### Альтернативы и почему НЕ они

| Альтернатива                  | Почему отвергнуто                    |
| ----------------------------- | ------------------------------------ |
| Telegraf                      | Менее современный, типы хуже         |
| node-telegram-bot-api         | Устаревший API, нет TypeScript-first |
| Telegram-Bot-API (PHP/Python) | Не TypeScript, дополнительный язык   |

---

## Telegram Mini App: Nuxt 4 + Telegram WebApp API

### Что выбрано

Те же Nuxt-страницы под `/m/*` префиксом, с адаптацией к Telegram WebApp API.

### Почему

- **Один кодбэйз** для web и Mini App.
- **Переиспользование компонентов.**
- **Знакомая разработчику среда.**

### Адаптации

- Mobile-first CSS (Tailwind + responsive).
- Layouts без header / footer для Mini App.
- Telegram WebApp API (`window.Telegram.WebApp`) для:
  - тема (`themeParams`)
  - MainButton (вместо кастомных submit-кнопок)
  - haptic feedback
  - BackButton
- Auth через `initData` (HMAC валидация на сервере).

### Альтернативы и почему НЕ они

| Альтернатива                | Почему отвергнуто                                             |
| --------------------------- | ------------------------------------------------------------- |
| Отдельный SPA для Mini App  | Дублирование кода, два проекта, два deploy                    |
| Native iOS/Android          | Не нужно, Telegram достаточно                                 |
| Прогрессивное Web App (PWA) | Telegram Mini App = PWA внутри Telegram, по сути одно и то же |

---

## Job Queue: TBD (Phase 15)

### Кандидаты

1. **BullMQ** — Redis-based, mature, хорошие типы.
2. **pg-boss** — PostgreSQL-based, без Redis.
3. **Trigger.dev** — managed service, но платный.

### Решение

Откладывается до Phase 15. Если Redis уже есть для сессий better-auth → BullMQ. Если нет → pg-boss.

---

## Object Storage: Selectel или Timeweb (Phase 9+)

### Решение

S3-compatible object storage у того же провайдера, что и VPS — для упрощения сетевой топологии и снижения исходящего трафика.

### Кандидаты

1. **Selectel Object Storage** — S3-API, дешёвый egress в свою же сеть.
2. **Timeweb S3** — S3-API, простая интеграция.
3. **Cloud.ru Object Storage** — российский, S3-совместимый.

### Что НЕ выбираем

- ❌ Cloudflare R2 — отлично, но международный, лишний egress
- ❌ AWS S3 — дорого с РФ
- ❌ Hetzner Object Storage — ЕС-резидентство данных нежелательно

### Решение

Phase 9 — Selectel Object Storage (если выбран Selectel под VPS), либо Timeweb S3.

---

## Email: предварительно Unisender Go или Postmark (Phase 3)

### Контекст

Email критичен для passwordless auth (email-code). Нужен:

- Высокая deliverability (письма не в спам)
- Доступность из российского VPS
- Поддержка кастомного домена (`mail.volleytime.by`)
- Бесплатный или дешёвый план для MVP

### Кандидаты

1. **Unisender Go** — российский транзакционный email-провайдер. Подходит для РФ-юрисдикции и работы с РФ-получателями. Free tier 1500 писем/мес.
2. **Postmark** — отличная deliverability, $15/мес от 10K писем. Работает из РФ, но платит со счёта в РФ через посредников.
3. **SendPulse** — украинский, но с РФ-офисом. Free tier 12000 писем/мес.
4. **AWS SES** — дёшево ($0.10 за 1000 писем), но оплата только западной картой.

### Что НЕ выбираем

- ❌ Resend — отличный сервис, но оплата только западной картой (для долгосрочного prod-использования из РФ сложно)
- ❌ Mailgun — закрыли регистрации из РФ
- ❌ Sendgrid — аналогично, проблемы с оплатой из РФ

### Решение

**Phase 3:** Unisender Go (free tier хватит на MVP).
**Phase 14+:** если delivery станет проблемой — миграция на Postmark или SendPulse.

---

## Monitoring: Sentry или GlitchTip (Phase 9)

### Что выбрано

[Sentry.io](https://sentry.io) free tier (5K events/month) — на старте.

### Почему

- Стандарт индустрии.
- Free tier достаточен на MVP.
- Хорошие интеграции с Nuxt и Node.js.
- Сервис доступен из РФ.

### Caveat для РФ

Sentry — американская компания, оплата только западной картой. Для бесплатного tier (5K events/мес) это не проблема. Если придётся переходить на платный — сложнее.

### Альтернатива

**GlitchTip** (glitchtip.com) — open-source, API-совместимый с Sentry. Можно поднять self-hosted на том же VPS или в Docker. Phase 14+ — рассмотреть миграцию если объём ошибок вырастет.

### Что ещё нужно

- **Uptime monitoring:** UptimeRobot (free tier 50 monitors), либо self-hosted UptimeKuma.
- **Logs aggregation:** на старте — Docker logs + grep. Phase 14+ — Loki / Grafana / dozzle.
- **Metrics:** на старте — встроенные в платформу dashboards. Phase 14+ — Prometheus + Grafana.

---

## Hosting: Российский VPS (Phase 9)

### Решение

**Размещение в российском VPS** — окончательное решение.

### Почему

- Близость к целевой аудитории (РФ + СНГ) даёт минимальный latency
- Юрисдикция РФ: при необходимости — соответствие ФЗ-152 (персональные данные)
- Возможность принимать платежи через российские эквайринги (Сбер, Тинькофф, ЮKassa) в будущем
- Стабильная связность с Telegram API из РФ
- Низкая стоимость по сравнению с Hetzner ЕС

### Кандидаты

1. **Selectel** (selectel.ru) — крупнейший, надёжный, дата-центры в Москве и СПб. Цены от 250 ₽/мес за минимальный VPS.
2. **Timeweb Cloud** (timeweb.cloud) — простой интерфейс, дешёвые VPS от 200 ₽/мес.
3. **RUVDS** (ruvds.com) — широкая география, есть конфигурации с NVMe.
4. **Beget** (beget.com) — простой админ-панель, хорошая поддержка.
5. **REG.RU Cloud** — большой провайдер с регистрацией доменов в одном месте.

### Рекомендация

**Selectel** или **Timeweb Cloud** — для production. Финальный выбор — Phase 9.

Рекомендуемая конфигурация для MVP:

- 2-4 vCPU
- 4-8 GB RAM
- 60-100 GB NVMe SSD
- Москва или СПб (close to Telegram API endpoints)
- Ubuntu 24.04 LTS

### Соображения по совместимости

#### bePaid из РФ

bePaid — белорусский provider. С российского IP webhook'и приходят корректно, исходящие запросы (создание checkout) работают. Однако:

- Налогообложение: организатор-резидент РФ принимает оплату от плательщика-резидента РБ — нужны отдельные правила (см. [docs/guides/TAXES.md](../guides/TAXES.md))
- Резиденты РФ могут предпочитать ЮKassa/Сбер/Тинькофф — добавляем в Phase 13 как альтернативу bePaid

#### Telegram API

Telegram API (api.telegram.org) доступен из российских дата-центров без специальных мер. Для bot — long-polling или webhook, оба работают.

#### Российское регулирование

- ФЗ-152 (персональные данные): для российских пользователей — хранение PII на серверах в РФ (✓ выполнено).
- ФЗ-149 (информация): обычные требования к operator.
- ФНС: при оборотах > 2.4 млн ₽/год — обязательная регистрация как ИП или ООО в РФ (для российского owner). При работе с РБ-организатором — отдельная юридическая модель.

#### Резервное копирование

- Daily backup PostgreSQL → объектное хранилище провайдера (Selectel Object Storage, Timeweb S3)
- Weekly off-site backup в другой дата-центр (РФ или соседняя страна)
- Сохранять минимум 30 дней

### Что не выбираем

- ❌ AWS / GCP / Azure — высокая стоимость, западная юрисдикция, риски блокировок
- ❌ Hetzner / OVH (ЕС) — latency для пользователей РФ выше, ЕС-юрисдикция усложняет работу с РФ-резидентами
- ❌ Облачные сервисы с РФ-офисами международных компаний (DigitalOcean без РФ-региона) — нерелевантны

### Upgrade path

- Phase 9 — single VPS (2-4 vCPU, 4-8 GB) на ~$10-30/мес
- Phase 14+ — отдельный VPS под PostgreSQL, отдельный под apps (если нагрузка вырастет)
- Phase 18+ — managed PostgreSQL у того же провайдера

---

## Языки и runtime

### Что выбрано

- **TypeScript** для всего кода (apps/web, apps/bot, packages/*)
- **Node.js 22+** runtime
- **pnpm** как package manager

### Почему TypeScript

- Типобезопасность критична для домена с финансами и состояниями.
- Один язык для frontend и backend.
- Drizzle, better-auth, grammY — все TypeScript-first.

### Почему pnpm (не npm/yarn)

- Быстрее.
- Корректнее работает с monorepo workspaces.
- Дисковая экономия (shared store).

### Альтернативы и почему НЕ они

| Альтернатива  | Почему отвергнуто                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Python        | Хорош, но отдельный язык для веба усложнил бы стек. Уже есть legacy Python-прототип, не хотим повторять. |
| PHP / Laravel | Уже есть legacy Volley Time на Laravel. Не хотим повторять.                                              |
| Go            | Меньше готовых решений для Telegram Mini App.                                                            |
| Rust          | Overkill для нашего масштаба.                                                                            |

---

## Тестирование

### Что выбрано

- **Vitest** — test runner (быстрее Jest, TypeScript-native).
- **@testing-library/vue** — для UI-тестов.
- **Playwright** — для E2E (Phase 9+).
- **PostgreSQL в Docker** для интеграционных тестов (не in-memory, не sqlite).

### Почему PostgreSQL для тестов

- В Drizzle/PG есть фичи (partial indexes, jsonb, FOR UPDATE), которых нет в SQLite.
- Лучше ловить реальные баги в реальной БД.
- Накладные расходы малы (Docker контейнер быстро поднимается).

---

## Deployment / DevOps

### Что выбрано (Phase 9)

- **Docker + docker-compose** для упаковки.
- **Caddy** как reverse proxy (HTTPS auto через Let's Encrypt).
- **GitHub Actions** для CI/CD (Phase 9).

### Почему Caddy (не nginx)

- Автоматический HTTPS из коробки.
- Простая конфигурация (Caddyfile).
- Меньше boilerplate.

---

## Что НЕ выбрано

### Свой UI-кит

- Используем Tailwind CSS + shadcn-vue (или nuxt-ui).
- Не пишем компоненты с нуля, кроме доменных (BookingCard, etc.).

### Своя i18n

- Phase 3: единственный язык — русский. Hardcoded строки в шаблонах ОК.
- Phase 11+: добавляем @nuxtjs/i18n если нужно.

### Свой WebSockets-сервер

- На MVP — polling каждые 5 секунд (паттерн Volley Time).
- WebSockets только в Phase 16+ если будет нужно для live-scoring.

### GraphQL

- Простые REST endpoints через Nitro достаточны.
- GraphQL добавил бы сложность без явной пользы для нашего масштаба.

---

## Решения, открытые на момент написания

1. **better-auth vs Lucia** — окончательно решаем в Phase 3 при первой реализации.
2. **Resend vs SES** — Phase 3.
3. **BullMQ vs pg-boss** — Phase 15.
4. **R2 vs Hetzner Object Storage** — Phase 9.
5. **Hosting provider** — Phase 9 (но сильный фаворит — Hetzner).

---

## Ссылки

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [MODULITH_ARCHITECTURE.md](./MODULITH_ARCHITECTURE.md)
- [../ROADMAP.md](../ROADMAP.md)
