---
id: '22.3.1'
phase: '22'
epic: '22.3'
status: todo
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-11-20
status_note: 'ADR per owner decisions 2026-11-20, implementation next'
ref_id: 'R-05'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['19.3.1', '22.1.2']
supersedes: []
decisions: ['D-20']
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-05-platform-settings.md'
  screens:
    [
      '4b-root-admin/12-screen.png',
      '4b-root-admin/13-screen.png',
      '4b-root-admin/14-screen.png',
      '4b-root-admin/15-screen.png',
      '4b-root-admin/16-screen.png',
      '4b-root-admin/17-screen.png',
      '4b-root-admin/18-screen.png',
      '4b-root-admin/19-screen.png',
    ]
tags: [reference-v3]
---

# Task 22.3.1: Настройки платформы (`R-05`)

## Цель

Глобальные параметры.

## Контекст

- Спецификация референса: [R-05 · Настройки платформы](../design/reference-v3/specs/04-root-admin/R-05-platform-settings.md); макет: 7 Root Admin → Настройки.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Общие, команда и роли, feature flags, лимиты и квоты, уведомления, биллинг, безопасность, API и вебхуки; изменения в журнал.
- **ADR (схема и контракт, правило 3 ORCHESTRATION):** [ADR-22-3-1](../architecture/ADR-22-3-1-platform-settings.md), решение владельца [D-20](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-20) (2026-11-20). Карточка реализуется строго по ADR; дельта макета ниже сужена решением D-20.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Доступ и аудит** — Права и журнал для всех интерфейсов. С этим связаны: [P-11 → 19.3.1](19-3-1-auth-roles.md), [W-16 → 20.5.1](20-5-1-auth.md), [M-01 → 20.4.1](20-4-1-telegram-shell.md), [R-07 → 22.1.2](22-1-2-audit-log.md), [R-03 → 22.2.2](22-2-2-grant-balance.md). [Подробнее](../design/reference-v3/specs/links.md#auth)

## Что должно быть сделано

Объём — по [ADR-22-3-1](../architecture/ADR-22-3-1-platform-settings.md) (D-20):

1. Миграция `0042_platform_settings`: таблица `platform_settings` и колонка `organizations.event_balance_unlimited_until`; rollback с guard; раздел deploy runbook.
2. Реестр ключей в `packages/shared` (Zod, границы, значения по умолчанию = текущее поведение), `getPlatformSettings()` с кэшем 30 с, root-only `GET/PATCH /api/platform/settings` (409 stale, no-op без аудита), внутренний `GET /api/internal/bot/settings`.
3. **Общие** (редактируемые): название платформы, контакт поддержки; валюта и регион — только чтение.
4. **Лимиты** (редактируемые): стартовый баланс новой группы, макс. опубликованных событий в день на группу, лимит нажатий кнопок бота.
5. Безлимит событий отдельной группы до даты (Минск, конец дня): API root, проверка в `spendOnPublish` и сериях, отображение в кабинете, Mini App и Root Admin, аудит set/changed/cancelled с причиной.
6. **Платежи**, **Безопасность**, **Интеграции** — только чтение булевых статусов (без ключей и секретов); feature flags — только чтение; **Уведомления** — «Скоро».
7. Изменения настроек и безлимита пишутся в `audit_log` в той же транзакции.
8. Визуальная сверка вручную на 1440×900 и 375×812 (D-16), отчёт в PR.

## Критерии приёмки

- ✅ Изменения пишутся в журнал
- ✅ Значения по умолчанию без строк в `platform_settings` равны поведению до 22.3.1
- ✅ Безлимит: в последний день по Минску публикация не списывает, на следующий день — списывает; отмена события из безлимита баланс не начисляет
- ✅ Отчёт визуальной сверки (вручную, D-16) по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/12-screen.png](../design/reference-v3/screenshots/4b-root-admin/12-screen.png), [4b-root-admin/13-screen.png](../design/reference-v3/screenshots/4b-root-admin/13-screen.png), [4b-root-admin/14-screen.png](../design/reference-v3/screenshots/4b-root-admin/14-screen.png), [4b-root-admin/15-screen.png](../design/reference-v3/screenshots/4b-root-admin/15-screen.png), [4b-root-admin/16-screen.png](../design/reference-v3/screenshots/4b-root-admin/16-screen.png), [4b-root-admin/17-screen.png](../design/reference-v3/screenshots/4b-root-admin/17-screen.png), [4b-root-admin/18-screen.png](../design/reference-v3/screenshots/4b-root-admin/18-screen.png), [4b-root-admin/19-screen.png](../design/reference-v3/screenshots/4b-root-admin/19-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Вне области по D-20: bePaid, инвойсы и «Подключить bePaid» (D-07); слово «credits» (D-10); «demo-квота 5» как отдельная сущность (D-12 — заменена настройкой стартового баланса); 2FA, IP-allowlist, активные сессии команды, API-ключи и вебхуки, вкладка «Команда & роли»; редактирование feature flags; TTL предложения листа ожидания (не редактируется); «Макс. игроков в org», «Бронь до подтверждения», «Rate limit бота msg/сек» из макета
- ❌ Не хранить в `platform_settings` и не отдавать в API ключи, токены, секреты и адреса вебхуков
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
