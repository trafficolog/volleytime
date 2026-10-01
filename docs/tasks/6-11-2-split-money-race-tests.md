---
id: '6.11.2'
phase: '6'
epic: '6.11'
status: in_progress
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: 'Локальные PostgreSQL barriers и денежные regression реализованы после принятых 6.11.1/8.11.1: focused characterization 3×37/37 GREEN; пять gates PASS, полный набор 143 файла/1031 тест. Production-дефект не выявлен, production-код не менялся. Независимое review и exact-head CI/merge ещё открыты.'
roles: [BE, QA]
depends_on: ['6.11.1', '8.11.1']
tags: [mvp, split, tdd, concurrency, money]
---

# Task 6.11.2: интеграционные проверки денег и гонок split

## Цель

Доказать, что одновременные операции не создают дублированные начисления, частичный settlement или неверную сумму.

## Контекст

[R0.7 spec](../superpowers/specs/2026-10-01-event-split-pricing-design.md). Ранее закрытые payment/cancel races остаются regression; тесты используют отдельную PostgreSQL-БД и управляемые barriers.

## Что должно быть сделано

1. Проверить concurrent settle/settle, book/settle, cancel/settle, promotion/settle, target edit/settle и full event cancel/settle.
2. Проверить confirm/reject/event cancel после фиксации: один доход/возврат, отсутствие deadlock и нового распределения, repeat после изменения платежа; full event cancel возвращает также succeeded payment ранее снятой split-брони.
3. Ввести контролируемый отказ посередине начисления и доказать атомарный rollback event/booking/payments/audit, отсутствие dispatch.
4. Проверить запреты режима после истории booking, PATCH bypass, foreign org/player access, free/subscription methods, bounds и privacy read models.

## Критерии приёмки

- Тесты проверяют SQL-state и sum(amount)=target для полного settlement, не один mock-call; фиксируют оба допустимых порядка конкурирующих операций.
- Ошибки не оставляют orphan payment, settled metadata без начислений или дублированную привязку; waitlist не платит.
- При найденном дефекте синхронизировать карточку до кода и сделать RED→GREEN; controlled money subset повторяется по установленной воспроизводимости, без произвольного ожидания.
- Пять gates и независимое review проходят на task branch; доступность БД обязательна, tests не доказывают Telegram или deploy.

## Подсказки

### Локальное evidence Task 6 (2026-10-01)

- `split-races.integration.test.ts`: обе очередности book/target edit/self cancel + promotion/direct promotion/full cancel относительно settlement, concurrent settlement и repeat после confirm/reject, полный rollback при PostgreSQL constraint failure второй allocation.
- `money-races.integration.test.ts`: все шесть детерминированных порядков confirm/reject/full cancel, refund ранее снятой succeeded split-брони, immutable IDs/amounts; fixed confirm/reject в обеих очередностях.
- `phase6-money-flows.integration.test.ts`: free/subscription promotion, отсутствие фиктивных денег и однократное восстановление сессии при concurrent full cancel.
- Test-only helper `event-lock-barrier.ts` удерживает отдельную transaction connection, проверяет `pg_locks.granted=false`, key/database и `pg_blocking_pids`; каждый следующий вызов запускается после доказанного ожидания предыдущего, release/ожидание результатов в `finally`. Cleanup всех трёх файлов ограничен собственными fixture IDs.
- Bounds/методы/доступ/режим после истории/PATCH/privacy и collect-then-dispatch уже покрываются принятыми Tasks 1–3; общий test gate повторяет их вместе с новыми гонками. GREEN characterization не обозначается RED; production-код не меняется без доказанного дефекта и предварительной синхронизации этой карточки.
- Task 6 выполняется перед UI Tasks 4/5 по решению controller: depends_on — только принятые 6.11.1 и 8.11.1. UI, Telegram, production и общий release QA остаются открытыми.
- Final-source focused command (`pnpm exec vitest run --project integration` с тремя указанными файлами) прошёл три раза подряд: 37/37, 8.94s / 8.61s / 8.67s. Пять gates: format PASS, lint 0 errors / 12 baseline warnings, typecheck 6/6, `pnpm test` 143 files / 1031 tests (532.69s), build 2/2. Первичный TS2556 нового test-wrapper исправлен rest-parameter сигнатурой и перепроверен; это ошибка тестовой типизации, не product RED. Независимое review/CI/merge остаются условием закрытия карточки.

Повторно использовать существующие integration fixtures и barriers из money-races, а не таймауты/sleep в качестве доказательства порядка.

## Не делать

Не добавлять тестовый hook в production ради гонки, не обращаться к production DB, не подменять денежные утверждения mock count или случайными Promise.all без контроля.
