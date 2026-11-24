---
id: '30.2.4'
phase: '30'
epic: '30.2'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-24
status_note: 'Перепланирование 19.0.5 (референс 2026-11-24). Релиз назначает владелец.'
ref_id: 'M-31'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['30.2.1', '30.2.3']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-31-qr-checkin.md'
  screens: []
tags: [reference-v3]
---

# Task 30.2.4: Отметка по QR на входе

## Цель

Игрок сканирует QR и одним действием отмечается и закрывает оплату.

## Контекст

- Спецификация референса: [M-31 · Отметка по QR на входе](../design/reference-v3/specs/02-mini-app/M-31-qr-checkin.md); обновление референса — [отчёт 2026-11-24](../design/2026-11-24-reference-v3-update.md).
- Макет: 3 Mini App → Событие (записан) → ··· → Отметиться на входе; 3 Mini App → Организатор → Состав сегодня → QR.
- **Как есть (main `69a5595`):** —
- **Дельта до референса:** всё, что в «Что должно быть сделано»; работающее не переписывается.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

**Объём** (по спецификации)

- QR события меняется раз в минуту
- После скана — «Вы на месте» и карточка оплаты, если не оплачено
- Организатор или тренер показывает QR на экране или отправляет в чат

## Критерии приёмки

- ✅ Отметка по QR попадает в P-19 со способом «qr»
- ✅ Старый QR не принимается
- ✅ IDOR- и ролевые тесты на каждый новый эндпоинт
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, токены, доменная логика.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
