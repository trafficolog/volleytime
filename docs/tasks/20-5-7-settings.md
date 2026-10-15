---
id: '20.5.7'
phase: '20'
epic: '20.5'
status: in_progress
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-15
status_note: 'Реализовано, ревью Opus ожидается: PR в main; разделы без API (способы оплаты, шаблоны расписания, переключатели уведомлений, статус бота) вынесены в отчёт QA 2026-10-15-20-5-7.'
ref_id: 'W-11'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['19.2.2']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-11-settings.md'
  screens:
    [
      '4-cabinet/17-screen.png',
      '4-cabinet/18-screen.png',
      '4-cabinet/19-screen.png',
      '4-cabinet/20-screen.png',
      '4-cabinet/21-screen.png',
      '4-cabinet/22-screen.png',
      '4-cabinet/23-screen.png',
      '4-cabinet/24-screen.png',
    ]
tags: [reference-v3]
---

# Task 20.5.7: Настройки группы в кабинете (`W-11`)

## Цель

Все подразделы настроек группы.

## Контекст

- Спецификация референса: [W-11 · Настройки](../design/reference-v3/specs/03-organizer-web/W-11-settings.md); макет: 4 Кабинет организатора → Настройки.
- **Как есть (main `e68acf2`):** Одна страница настроек с архивированием группы и переключателем абонементов.
- **Дельта до референса:** Подразделы: профиль, расписание по умолчанию, записи и оплата, залы, способы оплаты, уведомления, Telegram-бот, опасная зона; подсказка влияния у каждой настройки.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [M-08 → 20.4.7](20-4-7-invite-booking.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md), [W-14 → 24.1.2](24-1-2-group-page-render.md). [Подробнее](../design/reference-v3/specs/links.md#invite)
- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [P-02 → 19.2.2](19-2-2-group-settings.md), [W-09 → 21.2.6](21-2-6-subscriptions.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md), [W-04 → 20.5.5](20-5-5-event-create.md). [Подробнее](../design/reference-v3/specs/links.md#settings)

## Что должно быть сделано

1. Профиль группы
2. Записи и оплата: отмена, мест на игрока, режим записи по умолчанию, цена по умолчанию
3. Команда
4. Уведомления
5. Интеграции
6. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Каждая настройка подсказывает, на что влияет
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/17-screen.png](../design/reference-v3/screenshots/4-cabinet/17-screen.png), [4-cabinet/18-screen.png](../design/reference-v3/screenshots/4-cabinet/18-screen.png), [4-cabinet/19-screen.png](../design/reference-v3/screenshots/4-cabinet/19-screen.png), [4-cabinet/20-screen.png](../design/reference-v3/screenshots/4-cabinet/20-screen.png), [4-cabinet/21-screen.png](../design/reference-v3/screenshots/4-cabinet/21-screen.png), [4-cabinet/22-screen.png](../design/reference-v3/screenshots/4-cabinet/22-screen.png), [4-cabinet/23-screen.png](../design/reference-v3/screenshots/4-cabinet/23-screen.png), [4-cabinet/24-screen.png](../design/reference-v3/screenshots/4-cabinet/24-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
