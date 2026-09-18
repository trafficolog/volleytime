# 📚 Документация проекта Volleyball Bot

Двухслойная организация: **canonical product docs** (что строим) + **operations** (как строим).

## Два слоя документации

| Слой | Папки | Назначение |
|------|-------|------------|
| **Canonical product docs** | `phases/`, `epics/`, `tasks/` | Что строим: фазы, эпики, карточки задач. Источник истины для scope и критериев приёмки. |
| **Operations** | `operations/` | Как строим: журналы сессий, итераций, сгенерированные сводки статусов. |
| **Design & planning** | `superpowers/` | Архитектурные specs и implementation plans для отдельных задач. |
| **Справочники** | корень `docs/` | ROADMAP, ARCHITECTURE, DOMAIN, TAXES, BEPAID, DEPLOY, OPERATIONS, TESTING. |

**Важно:** canonical docs описывают и текущий код, и целевую функциональность. Поле `sync_state: drifted` означает, что карточка опережает реализацию — это нормально, такие задачи находятся в очереди на разработку.

## Дерево каталогов

```text
docs/
├── README.md                          # Этот файл
├── ROADMAP.md                         # Главный тактический план
├── ARCHITECTURE.md                    # Компоненты и поток данных
├── DOMAIN.md                          # Предметная область
├── TAXES_BY.md                        # Налоговая часть РБ + шаблон обращения в МНС
├── BEPAID.md                          # Интеграция с bePaid
├── DEPLOY.md                          # Варианты хостинга
├── OPERATIONS.md                      # Эксплуатация в проде
├── TESTING.md                         # Стратегия тестирования
│
├── phases/                            # 7 файлов — фазы продукта
│   ├── 1-mvp-foundation.md
│   ├── 2-subscriptions-and-manual-payments.md
│   ├── 2-5-extended-admin-panel.md
│   ├── 3-bepaid-integration.md
│   ├── 4-reminders-and-automation.md
│   ├── 5-reports-and-polish.md
│   └── 6-production-deploy.md
│
├── epics/                             # эпики, сгруппированные по фазам
│   ├── 1-1-project-infrastructure.md
│   ├── 1-2-data-model.md
│   ├── 1-3-basic-telegram-bot.md
│   ├── 1-4-future-stubs.md
│   ├── 1-5-tests.md
│   ├── 2-1-subscription-service.md
│   ├── 2-2-subscription-purchase-ux.md
│   ├── 2-3-booking-with-payment-choice.md
│   ├── 2-4-ledger.md
│   ├── 2-5-my-menu-for-player.md
│   ├── 2-6-extended-admin-panel.md
│   ├── 2-7-tests-phase2.md
│   ├── 2-8-user-management.md             # Phase 2.5
│   ├── 2-9-training-management.md         # Phase 2.5
│   ├── 2-10-manual-booking-control.md     # Phase 2.5
│   ├── 2-11-manual-subscription-control.md  # Phase 2.5
│   ├── 2-12-ledger-corrections.md         # Phase 2.5
│   ├── 2-13-subscription-plans-crud.md    # Phase 2.5
│   ├── 2-14-settings-ui.md                # Phase 2.5
│   ├── 3-1-bepaid-service.md
│   ├── 3-2-webhook-handling.md
│   ├── 3-3-payment-ux.md
│   ├── 3-4-security.md
│   ├── 3-5-tests-phase3.md
│   ├── 4-1-scheduler.md
│   ├── 4-2-reminders.md
│   ├── 4-3-auto-status-transitions.md
│   ├── 4-4-tests-phase4.md
│   ├── 5-1-admin-reports.md
│   ├── 5-2-exports.md
│   ├── 5-3-ux-polish.md
│   ├── 5-4-options.md
│   ├── 6-1-migrations.md
│   ├── 6-2-containerization.md
│   ├── 6-3-hosting.md
│   ├── 6-4-operations.md
│   └── 6-5-ci-cd.md
│
├── tasks/                             # Карточки задач
│   ├── 1-1-1-project-skeleton.md
│   ├── …
│
├── superpowers/                       # Design-артефакты
│   ├── specs/                         # Architecture/design specs
│   └── plans/                         # Implementation plans
│
└── operations/
    ├── templates/
    │   ├── session.md
    │   └── iteration.md
    ├── sessions/2026/                 # Журнал сессий
    ├── iterations/2026/               # Журнал коммитов
    └── status/                        # Сгенерированные сводки
        ├── current-state.md
        ├── drift-report.md
        ├── phases.md
        ├── epics.md
        └── tasks.md
```

## Иерархия сущностей

```
Phase (фаза)
  └── Epic (эпик)
        └── Task (задача)
              ├── superpowers/specs/…-design.md   (опционально)
              ├── superpowers/plans/….md          (опционально)
              ├── operations/sessions/…           (журнал сессии)
              └── operations/iterations/…         (журнал коммитов)
```

**ID-схема:** `N.M.K` — фаза.эпик.задача. Пример: `2.1.3` = Фаза 2, EPIC 2.1, задача 3.

**Особый случай — Phase 2.5:** «Расширенная админ-панель» логически расположена между Phase 2 и Phase 3. Её эпики продолжают сквозную нумерацию эпиков Phase 2: эпики 2.8–2.14. Это сохраняет существующую нумерацию Phase 3, 4, 5, 6 без сдвига.

## Конвенции имён файлов

| Тип | Паттерн | Пример |
|-----|---------|--------|
| Phase | `{N}-{slug}.md` | `2-subscriptions-and-manual-payments.md` |
| Epic | `{N-M}-{slug}.md` | `2-1-subscription-service.md` |
| Task | `{N-M-K}-{slug}.md` | `2-1-1-subscription-plans.md` |
| Design spec | `YYYY-MM-DD-task-{N-M-K}-{slug}-design.md` | `2026-05-24-task-2-1-1-subscription-plans-design.md` |
| Plan | `YYYY-MM-DD-task-{N-M-K}-{slug}.md` | `2026-05-24-task-2-1-1-subscription-plans.md` |
| Session | `YYYY-MM-DD-{context}.md` | `2026-05-24-phase-2-kickoff.md` |
| Iteration | `YYYY-MM-DD-{NNN}-{context}.md` | `2026-05-24-001-phase-1-mvp.md` |

## Frontmatter

### Общие поля (phase / epic / task)

```yaml
id: "2.1"              # 2.1 для эпика, 2.1.3 для задачи
phase: 2               # только в epic/task
epic: "2.1"            # только в task
status: done           # todo | in_progress | done | blocked | cancelled
sync_state: aligned    # aligned | drifted
last_reviewed: 2026-05-24
status_note: "…"
```

### Task — дополнительные

```yaml
roles:                 # BACK, FRONT, DB, BOT, QA, DEVOPS, PRODUCT, LEGAL
  - BACK
depends_on:
  - 2.1.2
estimated_hours: 3-4
tags:
  - subscriptions
  - decimal-math
```

## Содержимое карточки задачи (типовые секции)

1. **Цель** — одно-два предложения
2. **Контекст** — что уже сделано, от чего отталкиваемся
3. **Что должно быть сделано** — артефакты и функциональность
4. **Критерии приёмки** — измеримые условия done
5. **Подсказки** — ссылки на образцы, прототипы, связанные specs
6. **Не делать** — защита от расширения scope

## Роли в задачах

| Роль | Зона |
|------|------|
| `BACK` | `src/services/`, бизнес-логика |
| `BOT` | `src/bot/`, aiogram-хендлеры, FSM, клавиатуры |
| `DB` | `src/db/models.py`, миграции Alembic |
| `WEB` | `src/web/`, aiohttp-сервер, webhook |
| `QA` | `tests/` |
| `DEVOPS` | Docker, CI, скрипты, хостинг |
| `PRODUCT` | docs/, README, копирайт |
| `LEGAL` | МНС, оферта, регистрация ИП |

## Быстрые точки входа

- **Что делать дальше:** [ROADMAP.md](./ROADMAP.md)
- **Текущее состояние:** [operations/status/current-state.md](./operations/status/current-state.md)
- **Что ещё не реализовано:** [operations/status/drift-report.md](./operations/status/drift-report.md)
- **Все задачи и статусы:** [operations/status/tasks.md](./operations/status/tasks.md)

## Команды (планируется)

В Фазе 6 планируется добавить `Makefile` с командами по аналогии с референсом:

```bash
make docs-ops-new-session     # создать файл сессии из шаблона
make docs-ops-new-iteration   # создать файл итерации
make docs-ops-refresh         # пересобрать status/*.md и блоки в phase/epic/task
make docs-ops-check           # проверить консистентность
```

Пока эти файлы обновляются вручную.
