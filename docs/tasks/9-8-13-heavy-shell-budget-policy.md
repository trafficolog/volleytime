---
id: '9.8.13'
phase: '9'
epic: '9.8'
status: done
release: 'v0.1.7'
last_reviewed: 2026-10-05
status_note: 'Scoped inventory224/196/148/48, frozen gates и independent spec/quality review accepted; PR87 merged77dd104→main7e430b4, head/main CI37278198411/37278629925 all4SUCCESS, trees identical. Assertions/fixtures/production/global timeouts unchanged; historical timing cause unproved. Release9.8.11 отдельно.'
roles: [DEVOPS, QA]
depends_on: []
tags: [mvp, test, rollback]
---

# Task 9.8.13: согласование бюджетов тяжёлых shell-проверок

## Цель

Применить явно утверждённую пользователем политику к локальным тяжёлым deploy/rollback shell-тестам, не ослабляя их проверки или глобальный timeout.

## Контекст

2026-10-04 пользователь выбрал: «Да, 35/60 секунд для тяжёлого shell-набора». Предыдущий frozen full gate9.8.12 FAILED:1260/1264, четыре image-bundle теста превысили15/20s. Один unchanged diagnostic воспроизвёл три таймаута; причина замедления не доказана. Исторические FAILED logs сохраняются. Новый UI candidate8.11.3 не повторял этот неизменённый full gate.

## Что должно быть сделано

1. До изменений составить inventory реально исполняемых test-owned shell deploy/rollback cases: test title, файл, исходный эффективный timeout, число последовательных shell-вызовов, выбранный бюджет и обоснование. Начальные области: deploy-contract.test.ts, release-identity-contract.test.ts, ghcr-manual-deploy-contract.test.ts, deploy-image-bundle-contract.test.ts, split-rollback-contract.test.ts в apps/web/server/utils. Расширять область только при обнаружении непосредственно связанного executable shell case, фиксируя это до правки; статические source-string/metadata tests исключить.
2. Одиночный executable shell-сценарий получает35000ms. Составной сценарий с несколькими последовательными shell deploy/rollback/activation/smoke-вызовами получает60000ms. Сохранить existing60000ms; не уменьшать уже утверждённые лимиты. Подпроцессные stop/drain/deploy deadline и глобальные Vitest настройки не менять.
3. Менять только per-test/существующие scoped test-suite бюджеты. Не изменять assertions, fixture, порядок операций, SQL, бизнес-код или production scripts. Не добавлять абстракцию ради чисел. Для общей suite budget нельзя повышать timeout быстрых static tests: предпочтительны explicit per-test значения. Scoped ruling после review I1 разрешает только для трёх mixed tables заменить общий registration на эквивалентную регистрацию каждого исходного варианта с индивидуальным бюджетом; значения/порядок вариантов, развёрнутые имена, callback bodies и checks сохранить. Это metadata correction, не изменение сценариев.

## Критерии приёмки

- Inventory подтверждает границы и classification каждого изменения. Исторический RED сохранён; это test configuration change, не выдумывать новый product RED или доказанную причину ускорения.
- Однократный covering run затронутых shell-contract файлов, затем полный pnpm test с существующим PostgreSQL test container на frozen source, без параллельной второй suite. Ненулевой результат остаётся FAILED; не повторять без diagnosis/изменённого условия.
- Пять gates: pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build. Полные logs, exact source/commit hashes, cache disposition и независимое task review. Перед build отдельная fresh проверка отсутствия listener3317; пользовательский foreground QA runtime не запускать/останавливать и active .output не перезаписывать.
- Conventional commit с Task:9.8.13 и Release:v0.1.7. Карточка in_progress до полного acceptance/CI/integration. Успех тестов не закрывает browser/Telegram/pilot или release9.8.11.

## Inventory до изменений

2026-10-04 первоначальный inventory сохранён до numeric edits: evidence copy `.superpowers/sdd/2026-10-01-event-split-pricing/task-9813-budget-inventory.md` остаётся историческим checkpoint. После review I1 classification/ruling зафиксированы до registration edits; [актуальный перечень](../operations/qa/2026-10-04-heavy-shell-budget-inventory.md) и fix evidence `task-9813-fix1-budget-inventory.md` синхронизированы по строкам до source freeze. Восьмифайловая область не расширяется: 224 реально исполняемых cases, 196 executable shell; 148 получают/сохраняют 35000ms, 48 получают/сохраняют 60000ms. Прежние 138/58 отражают superseded registration budgets, а не корректную фактическую classification.

Controller до правок согласовал три непосредственно связанные области: `live-rollback-env-contract.test.ts` (helper image-bundle deploy), `runner-image-validation-contract.test.ts` (package/verify pipeline), `packages/core/src/events/split-rollback-races.integration.test.ts` (тот же shell fixture; пять PG cases). Static-only/Node-only cases, mocked lifecycle и transport deadlines исключены. В GHCR split guard и image-bundle split rollback migration/activation/smoke выполняют один вызов, manual два. В GHCR handoff valid выполняет deploy+rollback, четыре остальных варианта один deploy. Все три mixed tables используют индивидуальный metadata budget без изменения исходных значений/порядка вариантов, развёрнутых имён или callback bodies/assertions/fixture; прежнее исключение отменено.

## Подсказки

## Review I1 — fix round 1

Review обнаружило шесть одиночных recovery-вариантов, ошибочно описанных как составные. Принимается строгая пользовательская политика: одиночный top-level shell call — 35000ms, несколько — 60000ms. Ранее допущенное исключение для общего GHCR handoff registration отменяется для нового кандидата. Во всех трёх mixed tables (GHCR split guard, image-bundle split rollback, image-bundle GHCR handoff) бюджеты назначаются по фактическому варианту без изменения callback bodies/assertions/fixtures или набора/порядка параметров. Existing60000, которые существовали ДО задачи (BASE e946b2c), сохранить. Inventory и новые evidence должны отражать действительные counts; исторические отчёты/логи сохраняются неизменными.

Обязательны docs/DEVELOPMENT_PROCESS.md, согласованный R0.7 spec и сохранённые task-9812/task-8113 reports в plan workspace. Subagent-driven: один implementer, затем отдельное read-only review.

## Не делать

Не менять production, VPS, GitHub main/prod, flag, tag, global timeout, assertions, финансовые операции, fixtures или зависимости. Не удалять evidence/backup/images/данные; не reset DB и не terminate чужие процессы. Не трактовать рост бюджета как доказательство отсутствия performance defect.

## Main integration — 2026-10-05

Authoritative acceptance: [PR87](https://github.com/trafficolog/volleytime/pull/87), head `77dd104fc37faf5aaf1bb8b7d6e9c882cfef9e95`, main `7e430b4763065c9a455c73409c0995bbf967477a`, identical tree `d6c695b0c0fc5e422cebed7462b45070b9de36a5`; CI37278198411/37278629925 all4SUCCESS. Independent spec/quality APPROVE; frozen covering224 and five gates154/1220 PASS. Accepted scope remains metadata only; prior FAILED logs and unproved performance cause remain historical. [Final provenance](../operations/qa/2026-10-05-r07-final-code-checkpoint.md); pending task prose below superseded, release/manual acceptance separate.

Интеграция task9.8.13 ведётся отдельно от main `ade78281fb5e4f3bb20cd77043c1114ca9ad082c` в изолированном worktree `verify-9-8-5-final/volleytime`, ветка `trafficolog/test/9.8.13-main-budget-gates`. До source edits AST inventory подтвердил те же 224 expanded cases / 196 executable shell / 148 budget35000 / 48 budget60000. Все исходные имена, варианты/порядок и callback bodies совпадают с исторической базой `e946b2c`; три отличия относятся только к timeout metadata и перечислены в main-integration разделе inventory. Исторические counts/RED/отчёты сохраняются.

На этой main-базе existing60000 имеет только один исходный registration (image-bundle deploy A/B/rollback); он сохраняется. Три других исторических existing60000 на main исходно равны default5000/default5000/35000 и получают60000 по фактической composite classification. Assertion/fixture/product исправления задач9.8.12 и8.11.3 не входят в эту ветку.

Scoped workspace ruling: требование отсутствия listener3317 перед build защищает original foreground QA и его output. Для integration выполняется fresh read-only проверка listener3317 и различия worktree/output paths; build разрешён только в отдельном target, original QA не останавливается и его output не меняется. Task остаётся in_progress до controller independent review, exact-head CI и integration; локальные gates не закрывают release/manual acceptance.
