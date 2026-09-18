# 🔄 Migration Strategy

> **Last updated:** 2026-05-25
> Документ объясняет, как Volley Time переходит со старого зоопарка (Python-бот + Laravel-приложение) на единый стек Nuxt 4 + Drizzle + PostgreSQL + better-auth + grammY.

---

## Контекст

К моменту начала работы над новой платформой существуют **два предшественника**:

1. **Python-прототип «Volleyball Booking Bot»** — Telegram-бот на aiogram/SQLAlchemy/SQLite. Phase 1+2 реализованы, 25 тестов проходят. Содержит работающую бизнес-логику бронирования, абонементов, кассы.

2. **Level Volley (Laravel)** — полноценное веб-приложение для турниров. В продакшене. Содержит работающую логику событий, команд, матчей, судейских сессий, live scoreboard.

Эти проекты **не объединены технически** — у них разные стеки, БД, модели данных. Объединение происходит **на уровне domain knowledge**, не кода.

---

## Принципы миграции

1. **Никакого «технического долга в наследство».** Не пытаемся постепенно мигрировать Python-код в TypeScript или Laravel в Nuxt. Это создаст зоопарк надолго.

2. **Новый репозиторий с нуля.** Pure Nuxt 4 + Drizzle + PG + better-auth + grammY в монорепозитории. Старый код — в `legacy/` для справки.

3. **Domain knowledge переносится через документацию.** Из Python — паттерны бронирования и абонементов. Из Laravel — паттерны турниров и live-scoring. Всё это описано в `docs/DOMAIN.md` и `docs/architecture/ARCHITECTURE.md`.

4. **Гипотезы проверяются параллельно.** Python-прототип работает в одной группе для UX-валидации. Laravel остаётся в продакшене со своими турнирами. Новая платформа строится без давления «у меня production не работает».

5. **Никаких преждевременных оптимизаций.** Не пытаемся написать «универсальную» платформу для всех видов спорта на старте. Volleyball-only, Минск-only, потом расширяемся.

---

## Что делаем с Python-прототипом

### Решение: B + параллельное использование

- Архивирован в `legacy/python-prototype/`
- Используется как **источник domain knowledge** при написании новых модулей
- **Запускается в реальной волейбольной группе на пару месяцев** параллельно с разработкой новой платформы
- Цель параллельного запуска:
  - Валидировать UX гипотезы (распределение слотов, абонементы, ручная оплата)
  - Собрать обратную связь от реальных игроков и админа
  - Сформулировать корректировки для новой платформы

### Что НЕ переносится в новый код

- Сам Python-код, модели SQLAlchemy, тесты pytest
- Структура `src/services/`, `src/bot/handlers/` — она будет другой в TypeScript
- Конкретные имена методов, параметров

### Что ПЕРЕНОСИТСЯ в виде domain knowledge

- **Бронирование:**
  - Распределение слотов: `main` (12) → `rotation` (2) → `waitlist` (∞)
  - Unique-индекс `(user_id, event_id)` для защиты от двойной записи
  - Окно закрытия записи (`BOOKING_CLOSES_HOURS_BEFORE`)
  - Промоушен из waitlist при отмене

- **Абонементы:**
  - Планы 4x / 8x / 12x (но **scoped by organization** в новом стеке)
  - Атомарное списание сессии через `UPDATE ... WHERE used_sessions < total_sessions`
  - FIFO выбор для списания (по `expires_at ASC`)
  - Восстановление сессии при отмене брони

- **Платежи и касса:**
  - Цикл: pending → succeeded / failed / refunded
  - Идемпотентность через `bepaid_uid` unique
  - Касса как append-only журнал
  - Категории расходов: rent / balls / refund / other

- **Посещаемость:**
  - Цикл статусов брони: confirmed → attended / no_show
  - Отметка после тренировки

- **Отмена тренировки:**
  - Двухшаговое подтверждение
  - Массовый refund + restore_session
  - Массовое уведомление

### Когда Python-прототип отключается

После того как новая платформа достигнет **Phase 8** (Telegram Bot + Mini App) и одна из первых private-beta организаций успешно проведёт 5+ событий через новую платформу.

Ориентировочно: 3–4 месяца от начала Phase 3.

---

## Что делаем с Level Volley (Laravel)

### Решение: A после проверки гипотезы

- Остаётся в продакшене **до Phase 16-17** (Tournament Mode).
- Не трогаем код, не рефакторим, не миграции данных в новую БД.
- В Phase 16 (через 6-9 месяцев от старта) пересматриваем по результатам метрик.
- Если private beta новой платформы успешна и крупные клубы запрашивают турниры:
  - Phase 16: порт **Matches + Live Scoreboard + Stats** из Laravel
  - Phase 17: порт **Tournament Mode** (объединение Events + Matches)
- Если private beta не показала спроса на турниры — Phase 16-17 откладывается на неопределённый срок.

### Domain knowledge из Level Volley

Переносится на этапе Phase 16-17:

- **Events:**
  - Поле `type: training / open_game / tournament_match / custom`
  - Статусы: draft / open / in_progress / completed / cancelled
  - Настройки правил: `match_format`, `scoring_system`, `set_points`, `tiebreak_points`, `points_win`, `tiebreak_order`

- **Teams:**
  - Цвета (`color`)
  - Капитан (`is_captain`)
  - Алгоритмы генерации: random / balanced (по рейтингу)
  - Drag-and-drop игроков

- **Matches:**
  - Sets как отдельная сущность
  - `winner_team_id` определяется автоматически
  - Поле `version` для optimistic locking
  - Append-only журнал (Match Timeline)
  - `is_reverted` для undo-операций

- **Live Scoring:**
  - Score actions append-only
  - Auto-detection завершения сета (set_points + 2 diff)
  - Auto-detection завершения матча (sets_to_win)
  - Live scoreboard с auto-refresh (5 сек)

- **Standings:**
  - Tiebreak order: `wins → sets_diff → points_diff → head_to_head`
  - Системы очков: standard (3/2/1/0) и sum_points
  - MVP голосование (один голос на участника матча)

- **Auth & Roles:**
  - Email-code passwordless (10 мин TTL, 1 код / 60 сек, 5 попыток)
  - Role hierarchy: player → judge → organizer → admin
  - Role requests с pending / approved / denied
  - Event staff (judge / event_admin) — назначение на конкретное событие

- **UX-паттерны:**
  - Inline-editing с AJAX и индикаторами (✓ ⏳ ✗)
  - QR-код для публичной страницы
  - Tабы (Обзор / Команды / Матчи / Статистика)
  - Live scoreboard для проекторов
  - Mobile-first судейская сессия

- **Аудит:**
  - Полный audit log
  - Фильтрация: дата / пользователь / тип действия / сущность

### Что НЕ переносится из Laravel

- PHP-код, Eloquent-модели, контроллеры
- Blade-шаблоны
- Sessions / cookies механика — заменяется на better-auth
- CSRF-токены — better-auth даёт свой механизм

---

## Что строим с нуля

### Базовая инфраструктура (Phase 3)

- Монорепозиторий с workspaces (turborepo или pnpm workspaces)
- `apps/web` — Nuxt 4 (full-stack + Mini App)
- `apps/bot` — grammY Telegram bot
- `packages/db` — Drizzle schema + миграции
- `packages/shared` — типы, утилиты
- Docker Compose dev-environment: PostgreSQL + redis (для better-auth sessions)
- better-auth с email-code provider и Telegram identity link
- Базовая Drizzle schema: User, Organization, OrganizationMember, Session

### Multi-tenancy с первого дня (Phase 4)

- `Organization` как root aggregate
- `OrganizationMember` с ролями и статусами
- `InviteLink` с типами (organization_join / event_join / staff_invite)
- Все последующие модели создаются с `organization_id` сразу — никаких миграций задним числом

### Доменное ядро (Phase 5)

- `Event` (на старте поддерживает type: training / open_game)
- `Booking` с slot distribution (порт логики из Python-прототипа)
- `Subscription` + `SubscriptionPlan` (scoped by organization)
- `Waitlist` логика

### Финансы (Phase 6-7)

- `Payment` с method: cash / transfer / online / subscription
- `LedgerEntry` с категориями
- `EventCreditAccount` + `EventCreditTransaction` (платформенная монетизация)

### Telegram-интерфейс (Phase 8)

- Bot на grammY с базовыми хендлерами (deeplink на Mini App)
- Mini App: Nuxt routes под `/m/*` — компактный UI для Telegram WebApp
- Auth через Telegram initData → связывание с User в better-auth

---

## Стратегия данных

### Никакой миграции данных из старых проектов

- Python-прототип работает в реальной группе, но **его БД не переносится** в новую платформу.
- Когда новая платформа достигает MVP, организатор **вручную** заводит группу заново.
- Это нормально: за время Python-прототипа максимум 1-2 организации, можно повторить onboarding за час.

### Laravel-data — отдельная история

- Level Volley в проде имеет реальные данные турниров.
- Когда дойдёт до Phase 16-17, потребуется отдельная миграция БД.
- Это решается в момент Phase 16, не сейчас.

---

## Стратегия документации

### Старая документация

- Python-прототип имел богатую docs/ структуру с phases/epics/tasks
- Перенесена в `legacy/python-prototype/docs/`
- Сохранена для справки
- Не обновляется

### Новая документация

- Пишется в `docs/` с нуля
- Использует тот же паттерн (phases/operations/strategy)
- Но **frontmatter и task-карточки переписываются под TypeScript-стек**
- Все ссылки на Python-модули заменяются на Nuxt/Drizzle-эквиваленты

### Что наследуется из старой docs

- **DOMAIN.md** — основные сущности и бизнес-правила (адаптируется)
- **TAXES.md** — налоговая часть РБ + шаблон обращения в МНС (полностью переиспользуется)
- **BEPAID.md** — интеграция с bePaid (переиспользуется, но API-вызовы переписываются на TS)
- **ARCHITECTURE.md** — общая философия слоёв, но конкретика стека новая
- **ROADMAP.md** — полностью переписывается

---

## Риски миграции

### Риск 1: Соблазн «давайте сейчас порежем Laravel и сразу всё перенесём»

**Mitigation:** Жёстко придерживаемся стратегии «Laravel в продакшене до Phase 16+». Не открывать его код, пока не дойдём до Tournament Mode.

### Риск 2: Python-прототип «застрянет» в эксплуатации навсегда

**Mitigation:** Чётко указано в roadmap: Python отключается после успешной private beta новой платформы. Если в Phase 8 не запустимся в реальной группе — Python и не отключаем.

### Риск 3: Новая платформа окажется хуже старых

**Mitigation:** Phase 8 (MVP) и Phase 10 (Private Beta) — это явные гейты. Если новая платформа в Mini App хуже Python-бота по UX — стоп, рефакторим, не идём в Phase 11+.

### Риск 4: Стек Nuxt 4 + Drizzle + better-auth — экспериментальный

**Mitigation:**

- Nuxt 4 — стабилен на момент 2026-05.
- Drizzle — production-ready, имеет crowd-tested миграции.
- better-auth — относительно новый, но имеет email-code и Telegram identity из коробки. Если в Phase 3 окажется неподходящим — заменяем на Auth.js (NextAuth) или Lucia. **Это решается на Phase 3**, не сейчас.

---

## Когда мигрируем что

| Когда                         | Что                        | Куда                                         |
| ----------------------------- | -------------------------- | -------------------------------------------- |
| Сейчас                        | Python-прототип            | `legacy/python-prototype/` (архив)           |
| Сейчас                        | Старая docs                | `legacy/python-prototype/docs/` (архив)      |
| Phase 3                       | Domain knowledge из Python | docs/DOMAIN.md (новая) + код Phase 5-6       |
| Phase 3-8                     | Новая платформа            | `apps/`, `packages/`                         |
| Параллельно                   | Python-прототип            | работает в одной группе для UX-валидации     |
| Phase 8 готов                 | Python-прототип            | планируется отключение                       |
| После Phase 10 (Private Beta) | Python-прототип            | окончательно отключается                     |
| Phase 16-17                   | Laravel Level Volley       | порт Matches + Tournament Mode на новый стек |
| После Phase 17                | Laravel Level Volley       | планируется отключение                       |
| После проверки CRM-гипотез    | Laravel Level Volley       | окончательно отключается                     |

---

## Что делать прямо сейчас

1. **Прочитать [PLATFORM_VISION.md](./PLATFORM_VISION.md)** — общая стратегия.
2. **Прочитать [docs/ROADMAP.md](./ROADMAP.md)** — что делаем по фазам.
3. **Прочитать [docs/architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md)** — техническая архитектура.
4. **Начать Phase 3** — инициализация монорепозитория.
5. **В фоне:** обкатать Python-прототип в одной группе.

---

## Ссылки

- [README.md](../README.md)
- [PLATFORM_VISION.md](./PLATFORM_VISION.md)
- [ROADMAP.md](./ROADMAP.md)
- [DOMAIN.md](./DOMAIN.md)
- [architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md)
- [architecture/STACK_DECISIONS.md](./architecture/STACK_DECISIONS.md)
