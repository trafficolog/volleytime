---
id: '9.8.12'
phase: '9'
epic: '9.8'
status: done
release: 'v0.1.7'
last_reviewed: 2026-10-05
status_note: 'M6 source/independent integration review accepted, PR89 merged0ffc28d→mainc5bdaa8; exact head/main CI37287982764/37288439856 all4SUCCESS, trees identical. Frozen five gates157/1264 PASS, fixture/test byte-exact reviewed8583cba; accepted budgets preserved. Не закрывает9.8.11/production/Telegram/pilot.'
sync_state: synced
review_ref: M6
priority: P2
roles: [DEVOPS, QA]
depends_on: []
tags: [mvp, test, rollback, review-fix]
---

# Task 9.8.12: ограниченное завершение owned shell и бюджеты двух тестов

## Цель

Исключить бесконечное ожидание тестовой фикстуры при ошибке завершения собственного процесса; согласовать два локальных shell-бюджета с прямым решением пользователя.

## Контекст

Исходный локальный review candidate — `6f586aba1965c0fc0b01492aa2b02bdef6e38831`, не production. Scoped review M6 подтверждает: taskkill error/nonzero либо POSIX kill error не имеют bounded failure escape, close ждёт child close бесконечно. Полный прогон 1250/1252: два неизменённых теста превышают default5000ms, отдельно проходят1.04s/2.12s. Причина изменения длительности не доказана. Пользователь2026-10-04 утвердил отдельные corrections и60000ms для этих двух случаев.

## Что должно быть сделано

1. RED-тесты в `packages/core/src/__tests__/split-rollback-shell-fixture.test.ts` для termination nonzero/error/timeout: run и close ограниченно завершаются явной ошибкой, не утверждают успешный stop. Покрыть Windows и POSIX ветви детерминированной локальной имитацией на существующем test boundary; настоящий test-owned процесс при необходимости очищается тестом строго по PID, не по имени.
2. Минимально исправить `split-rollback-shell-fixture.ts`: обрабатывать статусы/errors завершения, ограничить ожидание child close после попытки stop. Сохранить исходную причину отказа и actionable owned PID/root evidence. Живой/неподтверждённый child запрещает удаление его temp root; не освобождать ownership как будто процесс завершён. Успешный normal close остаётся joined перед cleanup. Без нового общего process framework/production API.
3. Только следующие cases получают явные60000ms: `apps/web/server/utils/deploy-contract.test.ts` — `rejects the documented candidate-manifest/old-runtime partial state without mutation`; `apps/web/server/utils/release-identity-contract.test.ts` — `rejects unsafe explicit rollback targets before changing Git, manifest or runtime`. Уже согласованный manual GHCR60000ms сохранить; другие таймауты/assertions не менять.

## Критерии приёмки

- Genuine RED→GREEN для failed-termination bound; успешные timeout/close и реальные PostgreSQL rollback/drain races остаются зелёными. Покрывающие28cases не заменяют новые negative failure tests.
- Обе разрешённые shell-проверки выполняются при60000ms с неизменными financial/identity/assertions; исторический full FAILED и isolated diagnostics сохранены, причина не выдумана.
- Format/lint/typecheck/full pnpm test с точным существующим PostgreSQL test container/build: пять gates на frozen source, полные logs и hashes. Нет одновременной второй full suite. Typecheck/build cache явно указан.
- Build только после fresh separate absence listener3317. Пользовательский QA runtime не запускать/останавливать; не перезаписывать active .output.
- Отдельное независимое task review, scoped Conventional commit `Task: 9.8.12`, `Release: v0.1.7`. GitHub/main/live acceptance отдельно; эта карточка не закрывает9.8.11 или Telegram/pilot.

## Подсказки

Обязателен `docs/DEVELOPMENT_PROCESS.md`. Существующая test fixture, exact PID/process-group ownership и сохранённые отчёты original final review — источник diagnosis. Выбирать простое bounded rejection, а не притворный successful cleanup.

## Не делать

Не изменять production deploy/DB/schema/flag/timeouts, глобальный Vitest budget, SQL/assertions, dependency/tooling warnings. Не kill по process-name, не terminate unrelated processes/sessions, не удалять доказательства/backup/images/неподтверждённо живой temp root. Не публиковать/merge/deploy из implementation worker.

## Main integration — 2026-10-05

Authoritative acceptance: [PR89](https://github.com/trafficolog/volleytime/pull/89), head `0ffc28ddb3c6a12f3446c91633a5f36b604d42a0`, main `c5bdaa8c47ec57a9c576cce41f3bbd9b2a5d0f52`, identical tree `3d0c3d7c2d3fb9042f54f64b143537f088b1d711`; CI37287982764/37288439856 all4SUCCESS. Independent integration spec/quality APPROVE, no new finding. Historical pending prose below is superseded for this task only; historical FAILED/RED/GREEN logs retained. [Final provenance](../operations/qa/2026-10-05-r07-final-code-checkpoint.md).

Утверждённая Git-интеграция reviewed source `8583cbac087dce2aa2f51a0eaab367f7a5ba469a` выполняется отдельно от exact main `0d4668a2769d260c04f3bb1bbd76e80fb68b314d` в `verify-9-8-5-final/volleytime`. Сначала фиксируется этот additive checkpoint. Fixture и lifecycle tests сохраняют reviewed bytes; восемь budget files задачи9.8.13 сохраняют exact main registrations/budgets. Это replay, не новая implementation/TDD wave. Исторические RED/GREEN, FAILED full gate и diagnostic остаются в original task-9812-report.md и logs.

Все tracked bytes, включая карточку, замораживаются до пяти индивидуальных gates с existing exact PostgreSQL container и только `volleytime_test`. Fresh listener/path/reparse proof разрешает build в отдельном target output при работающем original QA3317; original runtime/source/output не меняются. Независимое integration review, exact-head CI и merge остаются controller checkpoints. Карточка остаётся in_progress; release9.8.11 и manual/production/Telegram/pilot acceptance не закрываются.
