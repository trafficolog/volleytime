---
date: 2026-05-26
duration_hours: 4
session_type: phase-elaboration
phase: '3'
goals:
  - 'Детально расписать Phase 3 Foundation: 8 эпиков, 22 задачи'
  - 'Каждая задача — готовая к работе без дополнительных вопросов'
  - 'Шаблоны для будущих фаз (phase/epic/task templates)'
outcomes:
  - 'Phase 3 расширенная phase-card с DoD, архитектурой, утверждёнными решениями'
  - '8 эпиков с DoD и списком задач'
  - '22 задачи с полным форматом (frontmatter + 6 секций)'
  - 'Templates для будущих сессий по другим фазам'
  - 'Status-файлы обновлены'
---

# Сессия 2026-05-26: детальная проработка Phase 3 Foundation

## Контекст

После предыдущей сессии (strategic pivot) проект имел документацию верхнего уровня + скелеты 18 phase-карточек. Phase 3 (Foundation) была расписана только на уровне «эпики, часы». Эта сессия — детализация Phase 3 до уровня executable tasks.

## Утверждённые решения Phase 3 (10 вопросов)

Перед написанием задач были утверждены 10 ключевых решений:

1. **Monorepo:** pnpm workspaces + Turborepo (для кеширования)
2. **ESLint:** flat config (eslint.config.js)
3. **Drizzle:** `drizzle-kit generate` (не push)
4. **Email в dev:** console.log + placeholder для Unisender Go (Phase 9)
5. **Scope Phase 3:** чистый foundation, никакой бизнес-логики
6. **Identity model:** C — equal, email и Telegram независимо создают аккаунт, можно связать
7. **CI:** lint + typecheck + test (без Docker build)
8. **Тесты:** локально shared PG (volleytime_test), в CI — PG service container
9. **TypeScript:** strict mode с первого дня
10. **Drizzle features:** сразу jsonb, partial indexes где нужно

## Расширенная phase-card 3-foundation.md

Обновлена до полноценного документа:

- Цель и контекст
- Предусловия (Node.js, pnpm, Docker, Telegram bot)
- Definition of Done (14 критериев)
- Архитектура Phase 3 (диаграмма структуры монорепо)
- Таблица эпиков (8 шт.) с задачами и часами
- Технические заметки (утверждённые решения, что НЕ делаем, fallback план)

## 8 эпиков Phase 3

| ID  | Эпик              | Задач | Часов | Зависимости |
| --- | ----------------- | ----: | ----: | ----------- |
| 3.1 | Monorepo init     |     3 |   4-5 | —           |
| 3.2 | Drizzle schema    |     3 |   5-6 | 3.1         |
| 3.3 | better-auth       |     4 |   6-8 | 3.2         |
| 3.4 | Nuxt 4 skeleton   |     3 |   5-6 | 3.3         |
| 3.5 | grammY skeleton   |     2 |   3-4 | 3.3         |
| 3.6 | Docker dev        |     2 |   2-3 | 3.1         |
| 3.7 | Vitest + tests    |     3 |   3-4 | 3.2, 3.3    |
| 3.8 | GitHub Actions CI |     2 |   2-3 | 3.7         |

**Итого:** 8 эпиков, 22 задачи, **30-40 часов**.

## 22 задачи

Все задачи имеют единый формат:

**Frontmatter:**

- id, phase, epic, status, sync_state, last_reviewed, status_note
- roles (BACK, FE, DEVOPS, DB, QA, SECURITY)
- depends_on (явные зависимости)
- estimated_hours
- tags

**Секции:**

1. **Цель** — 1-2 предложения, что делает задача
2. **Контекст** — почему нужна, что есть до и после
3. **Что должно быть сделано** — конкретные deliverables с code snippets, конфигами, командами
4. **Критерии приёмки** — измеримые условия done
5. **Подсказки** — gotchas, технические нюансы, ссылки
6. **Не делать** — защита от scope creep

### Полный список задач

**Epic 3.1 (Monorepo init):**

- 3.1.1 pnpm workspaces + структура папок (1-2 ч)
- 3.1.2 Turborepo с базовыми pipelines (1-2 ч)
- 3.1.3 TypeScript strict + ESLint flat + Prettier (2 ч)

**Epic 3.2 (Drizzle):**

- 3.2.1 Drizzle setup + connection + client (2 ч)
- 3.2.2 User + Account schema (2 ч)
- 3.2.3 Migrations workflow (1-2 ч)

**Epic 3.3 (better-auth):**

- 3.3.1 better-auth базовая установка + email-code provider (2 ч) ⚠ риск, есть fallback на Lucia
- 3.3.2 Dev email logger console.log (1 ч)
- 3.3.3 Telegram identity через initData HMAC (2-3 ч) ⚠ critical security
- 3.3.4 Account linking (email + Telegram) (1-2 ч)

**Epic 3.4 (Nuxt):**

- 3.4.1 Nuxt 4 init + Tailwind + layout (2 ч)
- 3.4.2 Веб-страницы auth (login, verify) (2 ч)
- 3.4.3 Mini App entrypoint с initData auth (1-2 ч)

**Epic 3.5 (grammY):**

- 3.5.1 grammY init + Bot client (1-2 ч)
- 3.5.2 /start handler с Mini App button (1-2 ч)

**Epic 3.6 (Docker):**

- 3.6.1 docker-compose.yml (postgres + redis + init scripts) (1-2 ч)
- 3.6.2 pnpm-scripts + setup.sh (1 ч)

**Epic 3.7 (Vitest):**

- 3.7.1 Vitest setup + workspaces config (1 ч)
- 3.7.2 Integration helpers (test DB, migrations, fixtures) (1-2 ч)
- 3.7.3 Smoke-тесты для всех пакетов (1-2 ч)

**Epic 3.8 (CI):**

- 3.8.1 ci.yml — lint + typecheck + unit test (1-2 ч)
- 3.8.2 Integration test job с PG service container (1 ч)

## Самые рискованные задачи (требуют внимания)

### 3.3.1 better-auth base

**Риск:** библиотека может не подойти под наш use case (Telegram identity как кастомный provider).

**Mitigation:** в задаче подробно описан fallback на Lucia v3. Переписывание ~6 часов, изолировано в `packages/auth`, другие пакеты не страдают.

**Когда понять что нужен fallback:** если в течение 3-4 часов работы становится ясно, что better-auth не даёт API для кастомного auth flow.

### 3.3.3 Telegram identity (HMAC валидация)

**Риск:** security-критическая задача. Ошибка валидации = любой может зайти под чужим именем.

**Mitigation:**

- Подробный алгоритм валидации с code-snippets из Telegram docs
- Конкретный пример HMAC computation
- 4+ unit-теста для разных edge cases (valid, tampered, expired, wrong token)
- Тестовый fixture-helper для генерации known-good initData

### 3.6.2 setup.sh

**Риск:** не работает на чистой машине, разработчик тратит часы на debug.

**Mitigation:**

- Команды проверены последовательно
- Скрипт идемпотентен (можно повторно запускать)
- Подробные ошибки если что-то не так

## Особенности формата задач

### Code snippets — полные

Все TypeScript-блоки в задачах — это **готовый к копированию код**, не псевдокод. Например, задача 3.3.3 содержит полную implementation `validateInitData` с HMAC, не только описание алгоритма.

### Импорты и пути — реальные

Используется реальный package naming `@volley-time/db`, `@volley-time/auth`, etc. — после реализации задач эти импорты будут работать.

### Зависимости — явные

Каждая задача в `depends_on` указывает, какие задачи должны быть завершены ДО. Это позволяет:

- Параллельную работу: задачи без зависимостей друг от друга можно делать параллельно
- Понять критический путь
- Не браться за задачу когда не готовы её предусловия

### Tags — для навигации

`tags` позволяют группировать задачи по сквозным темам:

- security: 3.3.3 (HMAC validation)
- migrations: 3.2.3, 3.8.2
- ci: 3.8.1, 3.8.2
- monorepo: 3.1.1, 3.1.2

## Templates для будущих сессий

Созданы 3 шаблона в `docs/operations/templates/`:

- `phase-template.md`
- `epic-template.md`
- `task-template.md`

При работе над Phase 4+ — используем эти шаблоны для консистентности.

## Status обновлён

`docs/operations/status/current-state.md` отражает:

- 4 главных + 6 strategy + 3 architecture + 3 guides = 16 верхнеуровневых docs
- 18 phase-карточек
- 8 эпиков (только Phase 3)
- 22 задачи (только Phase 3)
- 2 записи сессий
- 3 templates

## Что готово к Phase 3 implementation

После этой сессии можно:

1. Открыть `docs/tasks/3-1-1-pnpm-workspaces-init.md`
2. Работать по чек-листу
3. По завершении: пометить статус `done`, перейти к следующей задаче

Никаких дополнительных вопросов «как делать» возникать не должно. Если возникают — это сигнал что задача написана недостаточно подробно, нужно вернуться и доработать.

## Метрики качества документации

- **Phase 3 task cards:** 22 шт., 3823 строки, среднее 174 строки на задачу
- Все 22 имеют корректный frontmatter (id, phase, epic, status, sync_state, estimated_hours)
- Все 22 имеют 6 обязательных секций
- Все critical security задачи имеют unit-тесты в DoD
- Все рискованные задачи имеют fallback план

## Что дальше

### Сразу (Phase 3 implementation)

1. Зарегистрировать домен `volleytime.by`
2. Создать `@volleytime_dev_bot` через @BotFather
3. Создать GitHub-репозиторий
4. Открыть task 3.1.1 и начать работу

### Параллельно

- **Трек A:** обращение в МНС РБ / ФНС РФ
- **Трек B:** запуск Python-прототипа в реальной группе

### После Phase 3 (отдельная сессия)

- Детальная проработка Phase 4 (Organizations + Members + Invites)
- Использование templates для consistency
- Применение опыта Phase 3 при формулировании задач

## Метрики сессии

- Длительность: ~4 часа
- Создано файлов: 32 (1 phase-card обновлён, 8 эпиков, 22 задачи, 1 status, 3 templates)
- Объём task-карточек: 3823 строки
- Средняя задача: 174 строки

## Замечания

### Что хорошо получилось

- Единый формат всех задач
- Полные code-snippets вместо псевдокода
- Явные зависимости через `depends_on`
- Fallback планы для рискованных задач (3.3.1)
- Шаблоны для будущих фаз

### Что можно улучшить в следующих сессиях

- Для Phase 4+ — больше внимания к диаграммам user flows (особенно invite flow)
- Чёткий формат «сценарии тестирования» для каждой security-задачи
- Возможно, отдельный документ `docs/operations/sessions/READMEsession-workflow.md` с инструкцией как делать elaboration session
  EOF
  echo "session record done"
