---
id: '24.1.2'
phase: '24'
epic: '24.1'
status: todo
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'W-14'
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [FE, BACK]
depends_on: ['24.1.1', '20.1.3']
supersedes: []
decisions: []
estimated_hours: '16-32'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-14-group-page-render.md'
  screens: []
tags: [reference-v3]
---

# Task 24.1.2: Страница группы: серверный рендер и SEO (`W-14`)

## Цель

Публичная страница, которую находят по «волейбол {город} тренировки».

## Контекст

- Спецификация референса: [W-14 · Страница группы · рендер](../design/reference-v3/specs/03-organizer-web/W-14-group-page-render.md); макет: 4 Кабинет организатора → Страница группы → предпросмотр.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** SSR, schema.org, sitemap, canonical, OG, каталог города, Lighthouse SEO ≥ 95.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [W-11 → 20.5.7](20-5-7-settings.md), [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [M-08 → 20.4.7](20-4-7-invite-booking.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md). [Подробнее](../design/reference-v3/specs/links.md#invite)
- **Страница группы** — Конструктор организатора, рендер и модерация root. С этим связаны: [W-13 → 24.1.1](24-1-1-group-page-builder.md), [R-06 → 24.1.3](24-1-3-group-page-moderation.md), [P-02 → 19.2.2](19-2-2-group-settings.md). [Подробнее](../design/reference-v3/specs/links.md#seo)

## Что должно быть сделано

1. Серверный рендер
2. schema.org: SportsActivityLocation, Event, FAQPage
3. index/noindex по seoIndex
4. sitemap.xml, canonical, OG
5. Каталог «Волейбол в {город}»
6. Гео-тексты для ИИ-поиска

## Критерии приёмки

- ✅ noindex-страница отсутствует в sitemap и каталоге
- ✅ Lighthouse SEO ≥ 95
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
