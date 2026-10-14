---
id: '23.1.1'
phase: '23'
epic: '23.1'
status: todo
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-12'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [BACK]
depends_on: ['19.3.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-12-player-features.md'
  screens: []
tags: [reference-v3]
---

# Task 23.1.1: Личные функции игрока (`P-12`)

## Цель

Игрок сам выбирает, какие функции видит.

## Контекст

- Спецификация референса: [P-12 · Личные функции игрока](../design/reference-v3/specs/01-platform/P-12-player-features.md); макет: 3 Mini App → Профиль → Что показывать.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** 8 флагов, по умолчанию включены, данные выключенной функции не удаляются.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-03 → 23.2.1](23-2-1-home-feed.md), [M-12 → 23.2.3](23-2-3-profile-features.md), [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-14 → 23.1.2](23-1-2-feature-analytics.md), [M-15b → 26.1.4](26-1-4-ai-coach-ui.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-17 → 25.1.2](25-1-2-self-check.md), [M-18 → 25.1.3](25-1-3-skill-progress.md), [M-19 → 26.1.2](26-1-2-team-balancing.md), [M-20 → 25.1.4](25-1-4-streaks.md), [M-21 → 26.1.1](26-1-1-mvp-vote.md), [M-22 → 26.1.5](26-1-5-season-wrapped.md). [Подробнее](../design/reference-v3/specs/links.md#features)

## Что должно быть сделано

1. 8 флагов: cal, coach, warmup, self, mvp, teams, streak, wrapped
2. По умолчанию всё включено
3. Данные выключенной функции не удаляются
4. Расписание, запись и оплата не выключаются
5. Данные и API: GET/PATCH /me/features.
6. Вкладка «Календарь» в таб-баре Mini App игрока (решение владельца 2026-10-14, см. [20.4.2](20-4-2-tab-bar.md)): скрыта при выключенном флаге `cal`. Значение `cal` по умолчанию по решению владельца — «скрыта по умолчанию», флага до этой карточки нет; пункт 2 (по умолчанию всё включено) для `cal` уточнить у владельца до старта.

## Критерии приёмки

- ✅ Флаги сохраняются между сессиями и устройствами
- ✅ Вкладка «Календарь» скрывается и появляется при переключении флага `cal`
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
