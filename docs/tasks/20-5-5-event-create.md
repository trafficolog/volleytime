---
id: '20.5.5'
phase: '20'
epic: '20.5'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'W-04'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['20.1.1', '20.2.2', '20.1.3', '19.2.2']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-04-event-create.md'
  screens: ['4-cabinet/05-screen.png']
tags: [reference-v3]
---

# Task 20.5.5: Создание события и серии в кабинете (`W-04`)

## Цель

Одна форма для одного события и серии.

## Контекст

- Спецификация референса: [W-04 · Создание события](../design/reference-v3/specs/03-organizer-web/W-04-event-create.md); макет: 4 Кабинет организатора → События → Создать.
- **Как есть (main `e68acf2`):** `EventForm` + `EventPricingPanel` (fixed/split, 5.16.2), одно событие.
- **Дельта до референса:** Шаблоны типа, мест на игрока, режим записи с наследованием («только для этого события», «вернуть как в группе»), блок повтора с предпросмотром и списанием баланса, блокировка отправки при нехватке баланса.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).
- **Перенесено из 20.2.2 ([решение владельца 2026-10-15, D-04 (A)](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-04)):** визуальная сверка блока повтора (правило, предпросмотр дат, число публикуемых и черновиков, баланс после) по `4-cabinet/05-screen.png`; контракт — `POST …/series/preview`, `POST …/series`, `PATCH …/series/{id}`, `POST …/series/{id}/cancel` ([ADR](../architecture/ADR-v3-domain.md#серии-и-черновики-2022-d-04)). Текст интерфейса «N раз»: число повторений считается **до** исключений, исключённая дата уменьшает число событий (D-04 (D)); предпросмотр показывает итог. `POST …/series` требует `idempotencyKey` (8–64 символа `[A-Za-z0-9_-]`): клиент создаёт ключ один раз на попытку создания и повторяет его при повторе запроса; без ключа — 422.
- **Перенесено из 20.1.1 ([решение владельца 2026-10-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-01)):** визуальная сверка блока оплаты формы (фиксированная цена / сбор суммой, прогноз при полном составе) по `4-cabinet/05-screen.png`.

**Общий функционал с другими интерфейсами:**

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [M-23 → 21.1.2](21-1-2-org-event-create.md), [W-02 → 21.2.1](21-2-1-overview.md), [P-03 → 20.1.1](20-1-1-pricing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [P-08 → 20.2.1](20-2-1-event-balance.md), [M-16 → 25.1.1](25-1-1-warmup.md). [Подробнее](../design/reference-v3/specs/links.md#create-event)
- **Сбор суммой** — Цена считается в одном месте и одинаково показывается везде. С этим связаны: [P-03 → 20.1.1](20-1-1-pricing.md), [M-07 → 20.4.6](20-4-6-split-price-event.md), [W-05 → 20.5.6](20-5-6-event-card.md), [P-17 → 20.6.1](20-6-1-public-event-pages.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#split)
- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [W-11 → 20.5.7](20-5-7-settings.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [M-08 → 20.4.7](20-4-7-invite-booking.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md), [W-14 → 24.1.2](24-1-2-group-page-render.md). [Подробнее](../design/reference-v3/specs/links.md#invite)
- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [P-02 → 19.2.2](19-2-2-group-settings.md), [W-11 → 20.5.7](20-5-7-settings.md), [W-09 → 21.2.6](21-2-6-subscriptions.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md). [Подробнее](../design/reference-v3/specs/links.md#settings)
- **Разминка в событии** — Организатор включает разминку в событие, игрок видит и пропускает её. С этим связаны: [M-23 → 21.1.2](21-1-2-org-event-create.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-03 → 23.2.1](23-2-1-home-feed.md). [Подробнее](../design/reference-v3/specs/links.md#warmup)

## Что должно быть сделано

1. Тип, дата, время, зал
2. Основной состав (места) и мест на игрока
3. Оплата: фиксированная / сбор суммой
4. Запись: свободная / по приглашению — подстановка из группы, пометка «только для этого события», «вернуть как в группе»
5. Разминка в составе события и длительность (добавить в макет)
6. Повтор серией с предпросмотром дат и списанием баланса
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Форма блокирует отправку при нехватке баланса
- ✅ Значения по умолчанию берутся из P-02
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Визуальная сверка включает блок повтора серии по `4-cabinet/05-screen.png` (перенесено из 20.2.2)
- ✅ Визуальная сверка включает блок оплаты и прогноз цены split по `4-cabinet/05-screen.png` (перенесено из 20.1.1)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/05-screen.png](../design/reference-v3/screenshots/4-cabinet/05-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Поле «Разминка в составе события» добавляет 25.1.1, если гипотеза 9.2 пойдёт в работу
- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
