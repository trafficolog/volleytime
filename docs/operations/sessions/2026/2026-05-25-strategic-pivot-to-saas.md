---
date: 2026-05-25
duration_hours: 4
session_type: strategic-pivot
goals:
  - 'Перестроить проект из single-organizer Telegram-бота в SaaS-ready платформу'
  - 'Перейти со стека Python/Laravel на единый Nuxt 4 + Drizzle + PG + better-auth + grammY'
  - 'Зафиксировать видение, архитектуру, roadmap, domain model'
  - 'Обновить имя: Volley Time (домен volleytime.by), хостинг — российский VPS'
outcomes:
  - 'Создан новый репозиторий volley_time_platform/ с архивацией старого Python-кода в legacy/'
  - 'Написана полная стратегическая документация (10 документов)'
  - 'Roadmap переработан: 18 фаз вместо 6'
  - 'Все 18 фаз имеют phase-карточки со списком эпиков'
  - 'Создан полный DOMAIN.md с multi-tenancy с первого дня'
  - 'Архитектура зафиксирована как modulith'
---

# Сессия 2026-05-25: переход к SaaS-ready платформе Volley Time

## Контекст

После завершения Phase 1+2 Python-прототипа и подробного планирования Phase 2.5-6, пользователь принёс **новое видение**:

1. Проект развивается не как single-organizer бот, а как **SaaS-ready платформа**.
2. Стек переписывается на TypeScript: **Nuxt 4 + Drizzle + PostgreSQL + better-auth + grammY**.
3. Параллельно существует **Level Volley** (Laravel-приложение для турниров) в продакшене — оно станет источником domain knowledge для Phase 16-17.
4. **Volley Time** — новое имя платформы (домен `volleytime.by`). При расширении на другие виды спорта — ребрендинг в «ВТЕМПЕ» (vtempe.by/vtempe.ru).
5. **Хостинг — российские VPS** (Selectel или Timeweb Cloud).

## Утверждённые решения (10 ключевых вопросов)

1. **Стек:** B1 — полный переход на TypeScript. Python и Laravel в legacy.
2. **Python-прототип:** B — параллельный запуск в реальной группе для UX-валидации.
3. **Level Volley (Laravel):** A после проверки гипотезы — остаётся в продакшене, переписывается в Phase 16-17.
4. **CRM:** после явного подтверждения гипотезы о востребованности.
5. **Phase 2.5:** B — переработать с учётом multi-tenancy (новые модели сразу с organization_id).
6. **Training → Event:** A — переименовать сразу с полем type (training/open_game/tournament_match/custom).
7. **CRM-граница в Phase 2.5:** только список/поиск/карточка/блокировка/роли. Заметки, теги, сегменты — Phase 18.
8. **Subscription plans + AppSettings:** scoped by organization + платформенные глобальные настройки отдельно.
9. **Telegram Mini App:** основной интерфейс. Один Nuxt-проект с префиксом /m/* для Mini App.
10. **Phase 4 (Scheduler):** a — после SaaS-readiness, в новой нумерации это Phase 15.

## Финальный roadmap (18 фаз)

```
Phase 1-2 ✅ Python legacy (25 тестов, обкатка в группе)
Phase 3   Foundation (Nuxt 4 + Drizzle + PG + better-auth + grammY) [30-40ч]
Phase 4   Organizations + Members + Invites [40-50ч]
Phase 5   Events + Bookings + Subscriptions [50-70ч]
Phase 6   Manual Payments + Ledger [20-30ч]
Phase 7   Event Credits (платформенная монетизация) [20-30ч]
Phase 8   Telegram Bot + Mini App ← MVP RELEASE [60-80ч]
Phase 9   Production Deploy (minimal) [15-25ч]
Phase 10  Private Beta ← ГЕЙТ ГИПОТЕЗ
═══ Расширение после подтверждения гипотез ═══
Phase 11  Contributions (сборы) [25-35ч]
Phase 12  Online Payments — own org (bePaid) [30-40ч]
Phase 13  Online Payments — organizer add-on [25-35ч]
Phase 14  Reports & Export [25-35ч]
Phase 15  Reminders & Automation [20-30ч]
═══ Турниры после запроса клубов ═══
Phase 16  Matches + Live Scoreboard + Stats (порт Level Volley) [60-80ч]
Phase 17  Tournament Mode [50-70ч]
═══ CRM после явного запроса крупных клубов ═══
Phase 18  CRM Pro [80-120ч]
```

Критический путь к MVP: Phase 3→8 ≈ 240-325 часов (3-4 месяца full-time соло).

## Бизнес-модель

**Event credits** как основная монетизация MVP:

- Организатор покупает право создать N событий
- 5 demo credits при регистрации
- Пакеты 1/10/30/100 по 5/40/105/300 BYN
- Платформа НЕ принимает деньги за организаторов — игрок платит организатору напрямую

После Phase 10: tier-планы (Start, Regular ~15 BYN/мес, Club ~40 BYN/мес, Pro Tournament, CRM Pro add-on).

## Структура нового репозитория

```
/home/claude/volley_time_platform/
├── README.md                          ✅
├── docs/
│   ├── PLATFORM_VISION.md             ✅
│   ├── MIGRATION_STRATEGY.md          ✅
│   ├── ROADMAP.md                     ✅
│   ├── DOMAIN.md                      ✅
│   ├── architecture/
│   │   ├── ARCHITECTURE.md            ✅
│   │   ├── MODULITH_ARCHITECTURE.md   ✅
│   │   └── STACK_DECISIONS.md         ✅
│   ├── strategy/
│   │   ├── SAAS_STRATEGY.md           ✅
│   │   ├── BILLING_AND_ENTITLEMENTS.md ✅
│   │   ├── ORGANIZER_MONETIZATION.md   ✅
│   │   ├── INVITES_AND_MEMBERSHIP.md   ✅
│   │   ├── CONTRIBUTIONS.md            ✅
│   │   └── PRIVATE_BETA_PLAN.md        ✅
│   ├── phases/                        ✅ (18 phase-карточек скелетно)
│   ├── guides/
│   │   ├── TAXES.md                   ✅ (РБ + РФ)
│   │   ├── BEPAID.md                  ✅
│   │   └── DEPLOY.md                  ✅ (российский VPS)
│   └── operations/
│       └── sessions/2026/
│           └── 2026-05-25-strategic-pivot-to-saas.md  ← вы здесь
└── legacy/
    └── python-prototype/              ✅ (старый код + docs)
        ├── src/, tests/, alembic/
        ├── docs/, requirements.txt, pytest.ini
        └── README.md
```

## Ключевые архитектурные решения

### Multi-tenancy с первого дня

Organization как root aggregate, User глобальный, OrganizationMember как many-to-many, все операционные сущности scoped by organization_id.

### Modulith (модульный монолит)

apps/web (Nuxt 4) + apps/bot (grammY) + packages/db (Drizzle) + packages/auth (better-auth) + packages/shared. Модули общаются через public service interfaces с ServiceContext, не напрямую в таблицы.

### Feature entitlements

Доступ к фичам через OrganizationFeature (source: plan/addon/trial/admin_grant), не по plan-коду.

### Auth

better-auth с email-code passwordless (6 знаков, TTL 10 мин, 1 код/60 сек, 5 попыток на код — паттерн из Level Volley) + Telegram identity через initData HMAC валидацию.

### Хостинг

Российский VPS (Selectel или Timeweb Cloud). Москва, 4 vCPU / 8 GB. Caddy + Docker + PostgreSQL + Redis.

### Email

Unisender Go (российский) или SendPulse — на старте. Postmark если потребуется выше deliverability.

## Что переносится из Python-прототипа

Не код, а domain knowledge:

- Slot distribution main(12)→rotation(2)→waitlist
- Атомарное consume_session через UPDATE...WHERE used<total
- FIFO subscription по expires_at
- Идемпотентность платежей через unique-индекс
- Цикл Payment: pending→succeeded/failed/refunded
- Цикл Booking: pending_payment→confirmed→attended/no_show
- Promote_from_waitlist при отмене
- Refund при отмене тренировки админом

## Что переносится из Level Volley (Phase 16-17)

- Match Timeline append-only с is_reverted (золотой паттерн)
- Optimistic locking через version field
- Live scoreboard auto-refresh 5 сек
- MVP voting (один голос на участника)
- Standings с tiebreak_order и scoring_system (standard/sum_points)
- Match score actions append-only
- Email-code auth (для better-auth)
- Role hierarchy: player → judge → organizer → admin
- Role requests с pending/approved/denied
- Event staff (judge, event_admin) per event
- Inline-editing с AJAX и индикаторами (✓ ⏳ ✗)
- QR-код для публичной страницы
- Tабы (Обзор/Команды/Матчи/Статистика)

## Параллельные треки

### Трек A — Юридическое

- Обращение в МНС РБ (или ФНС РФ) по шаблону
- Регистрация ИП / самозанятости / НПД
- Блокирует Phase 12-13 (online payments) и Phase 7 (event credits)

### Трек B — Python-прототип

- Запустить в реальной волейбольной группе на 2 месяца
- Цель: UX-валидация и сбор реального фидбэка
- Параллельно с Phase 3-8

## Метрики гипотез

H1: Telegram-first работает — ≥80% операций через Mini App  
H2: Event credits как монетизация — ≥1 организатор купил пакет  
H3: Ручная оплата достаточна для MVP — ≥90% событий без жалоб  
H4: Абонементы — киллер-фича — ≥30% активных игроков используют  
H5: Online payments улучшают retention (после Phase 12)  
H6: Контрибуции востребованы (после Phase 11)  
H7: Турниры — отдельный рынок: ≥3 запроса до Phase 16  
H8: CRM для крупных клубов: ≥1 запрос на add-on

## Гейт-критерии Phase 10 Private Beta

- ≥ 2 организатора активно используют ≥ 1 месяц
- ≥ 50 событий создано
- ≥ 200 бронирований
- ≥ 1 организатор готов платить за credits
- ≥ 80% операций без обращения в поддержку

## Что дальше

### Сразу

1. **Запустить Python-прототип в реальной группе** (Трек B) для UX-валидации.
2. **Начать Phase 3** — Foundation: монорепозиторий, Drizzle schema, better-auth.

### В первый месяц (отдельные сессии)

3. **Сессия по Phase 3** — детальный план эпиков и задач для Foundation.
4. **Сессия по Phase 4** — детальный план Organizations + Members + Invites.
5. **Параллельно: Трек A** — обращение в МНС/ФНС, выбор юр.режима.

### В следующие 2-3 месяца

6. Phase 3-7 реализация.
7. Phase 8 — MVP-релиз в Telegram.
8. Phase 9 — production deploy на российском VPS.
9. Phase 10 — onboarding 2-5 organizers для private beta.

### Решение после Phase 10

- Если гейт пройден → Phase 11+ (расширение).
- Если нет — анализ и возможный pivot.

## Что НЕ делаем сейчас

- ❌ Реализация кода (только документация)
- ❌ Setup репозитория на GitHub (это Phase 3)
- ❌ Договор с bePaid (это Phase 12)
- ❌ Регистрация юр.лица (это Трек A)
- ❌ Phase-карточки с детальными эпиками и задачами (это отдельные сессии)

## Ресурсы

- Все ключевые документы созданы и связаны
- 18 phase-карточек содержат скелет с DoD, эпиками, depends_on
- Готов к продолжению: следующая сессия — детальная проработка Phase 3
