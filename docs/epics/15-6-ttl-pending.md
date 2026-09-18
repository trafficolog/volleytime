---
id: '15.6'
phase: '15'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: 'TTL pending_payment — механизм готов, активен ТОЛЬКО для online (Phase 12). Cash НЕ трогаем.'
estimated_hours: '1-2'
depends_on: ['15.1', '6.1']
---

# Epic 15.6: TTL pending_payment (online-ready, cash не трогаем)

**Цель.** Механизм TTL для неоплаченных броней: pending_payment online висит N минут → авто-отмена (освобождает место). ТОЛЬКО для method=online (Phase 12); cash/transfer НЕ трогаем.

## Контекст

Решение 5 (тонкий момент): cash/transfer подтверждает организатор ВРУЧНУЮ, может занять часы. TTL отменил бы наличные пока организатор идёт — сломал бы cash-flow. Поэтому TTL применяется только к online (Phase 12, где игрок платит сам, спешка осмысленна).

В Phase 15 механизм готовится, но до Phase 12 (нет online-method) фактически не срабатывает.

## Definition of Done

- booking.pending_ttl задача (регистрируется при создании online-брони)
- Handler: если бронь всё ещё pending_payment + method=online → отмена + promotion (confirm-flow 15.5)
- cash/transfer брони НЕ получают TTL-задачу (ждут организатора)
- TTL значение конфигурируемо (дефолт 15 мин, для Phase 12)
- Idempotent (уже не pending → пропуск)
- Документировано: активируется в Phase 12

## Задачи

| ID     | Задача                                       | Часов |
| ------ | -------------------------------------------- | ----: |
| 15.6.1 | pending_ttl механизм (online-only) + handler |   1-2 |

## Не делать

- ❌ Не применять TTL к cash/transfer (отменит до подтверждения организатором)
- ❌ Не активировать для несуществующего пока online (готовим к Phase 12)
- ❌ Не отменять бронь без проверки актуального статуса
