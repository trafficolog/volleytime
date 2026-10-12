---
id: '20.4.2'
phase: '20'
epic: '20.4'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-02'
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.2.2']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-02-tab-bar.md'
  screens: ['3-miniapp-player/01-screen.png', '3-miniapp-organizer/01-screen.png']
tags: [reference-v3]
---

# Task 20.4.2: Таб-бар Mini App (`M-02`)

## Цель

Нижняя навигация, которая подстраивается под группу и игрока.

## Контекст

- Спецификация референса: [M-02 · Таб-бар](../design/reference-v3/specs/02-mini-app/M-02-tab-bar.md); макет: 3 Mini App → таб-бар.
- **Как есть (main `e68acf2`):** `components/vt/TabBar.vue` (8.10.1/8.10.2), абонементы скрываются по `subscriptionsEnabled`.
- **Дельта до референса:** Набор вкладок v3: игрок — Главная / Абонементы* / Сборы / Профиль (Календарь после P-12), организатор — События / Игроки / Касса / Сборы / Меню; точка у новой вкладки; плавающий тёмный док.
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [P-02 → 19.2.2](19-2-2-group-settings.md), [W-11 → 20.5.7](20-5-7-settings.md), [W-09 → 21.2.6](21-2-6-subscriptions.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md), [W-04 → 20.5.5](20-5-5-event-create.md). [Подробнее](../design/reference-v3/specs/links.md#settings)
- **Абонементы** — Выключатель в кабинете скрывает вкладку и продажу в Mini App. С этим связаны: [W-09 → 21.2.6](21-2-6-subscriptions.md), [M-13 → 20.4.9](20-4-9-player-screens.md), [P-02 → 19.2.2](19-2-2-group-settings.md), [P-03 → 20.1.1](20-1-1-pricing.md). [Подробнее](../design/reference-v3/specs/links.md#subs)
- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12 → 23.1.1](23-1-1-player-features.md), [M-03 → 23.2.1](23-2-1-home-feed.md), [M-12 → 23.2.3](23-2-3-profile-features.md), [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-14 → 23.1.2](23-1-2-feature-analytics.md), [M-15b → 26.1.4](26-1-4-ai-coach-ui.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-17 → 25.1.2](25-1-2-self-check.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-20 → 25.1.4](25-1-4-streaks.md), [M-21 → 26.1.1](26-1-1-mvp-vote.md), [M-22 → 26.1.5](26-1-5-season-wrapped.md). [Подробнее](../design/reference-v3/specs/links.md#features)

## Что должно быть сделано

1. Главная · Календарь · Абонементы · Сборы · Профиль
2. «Абонементы» скрыты при subsOn = false
3. «Календарь» скрыт при выключенном флаге cal (после P-12)
4. Точка у новой вкладки до первого открытия
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Не больше 5 вкладок
- ✅ Скрытие вкладки не ломает активную
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-player/01-screen.png](../design/reference-v3/screenshots/3-miniapp-player/01-screen.png), [3-miniapp-organizer/01-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/01-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`, `docs/design/reference-v3/handoff/screens-organizer.jsx`, `docs/design/reference-v3/handoff/screens-contributions.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Haiku-задача: только вёрстка, тексты и переименования. Если нужна бизнес-логика — остановиться и эскалировать оркестратору.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
