---
id: '8.11.3'
phase: '8'
epic: '8.11'
status: done
release: 'v0.1.7'
last_reviewed: 2026-10-05
status_note: 'N1 accepted: original RED8→GREEN72, source/Chrome/native200 and independent integration review approved; PR90 mergedc8dd12ed→main003968944, CI37293801825/37294307936 all4SUCCESS, exact trees. Frozen five gates157/1316 PASS; original historical FAILED logs/E2 limits retained. Release9.8.11/Telegram/pilot separately open.'
roles: [FRONTEND, QA]
depends_on: []
tags: [mvp, miniapp, review-fix]
---

# Task 8.11.3: сохранение event action на URL с завершающим слешем

## Цель

Поддерживаемый URL события с завершающим `/` сохраняет ownership уже отправленной записи/отмены при смене только query/hash.

## Контекст

Scoped review6f586ab N1: router strict:false принимает optional trailing slash, а raw pathname сравнивается с синтезированным URL без слеша. Это отдельная утверждённая regression task, не повтор завершённой final fix wave. Base8583cba содержит approved source9.8.12, но failed full gate не закрыт.

## Что должно быть сделано

1. RED в actual `pages/m/orgs/[orgId]/events/[eventId]/event-consumer.interaction.test.ts`: trailing-slash старт, held booking/cancel POST, query/hash, busy/no duplicate, success и delayed409→GET refresh. Проверять дефект, не ошибку selector/mock.
2. Минимально согласовать identity со spelling маршрута текущего router в `index.vue`. Настоящий уход на `/edit`/другое событие/группу остаётся departure; без общего URL framework/router redirects.
3. Повторить canonical/trailing negative confirm: query/hash во время подтверждения запрещает POST, leave-return/unmount/latest cannotCancel защищены, late response после ухода не пишет старый UI.

## Критерии приёмки

- Genuine RED→GREEN actual consumer; held booking/cancel success/refusal/no duplicate, departure и confirmation lifetime.
- Пять frozen gates с точным PostgreSQL test container; budgets неизменны. Если inherited fullgate блокирован четырьмя image-bundle таймаутами — сохранить FAILED, не повторять full suite без изменений/решения controller и не объявлять acceptance. Fresh3317absence перед build, без остановки/запуска пользовательского runtime.
- Отдельное review/CI и целевая real-API Chrome320/390 light/dark/applicable200% canonical/trailing после reviewed build. Unit tests не заменяют browser/TG. Историческая QA сохраняется для неизменённых экранов, Telegram/pilot после полного deploy.
- Conventional `Task: 8.11.3`, `Release: v0.1.7`; до полного evidence статус in_progress. Main/prod/flag/tag/server не изменяются worker.

## Подсказки

Обязателен docs/DEVELOPMENT_PROCESS.md, утверждённый R0.7 spec и существующие request/confirmation/view guards. Не менять деньги/права/API.

## Не делать

Не менять формы/дизайн/финансовые правила/тестовые процессы/таймауты/dependencies, не ослаблять stale guard, не публиковать/deploy, не удалять evidence/images/backup и не reset DB.

## Integration checkpoint — 2026-10-05

Authoritative acceptance: [PR90](https://github.com/trafficolog/volleytime/pull/90), head `c8dd12edde97134d708e1329ebceedf8da93f44b`, main `003968944c4e5f5f3a48685c2deb316e0e8a014a`, identical tree `43921551ee01b6ffd7c28db191a350425490802e`; CI37293801825/37294307936 all4SUCCESS. Independent integration spec PASS/quality APPROVED, no new finding. Literal binary equality of full non-doc candidate to original22c0850 reverified for final checkpoint; affected Chrome100/native200 accepted with E1 closed and E2 functional provenance retained. [Final provenance](../operations/qa/2026-10-05-r07-final-code-checkpoint.md). Pending prose below is historical;9.8.11/live/manual remain open.

Approved replay of reviewed `e946b2c4631ba6c3a399920c8807a5783c6e0a9c` onto accepted main `c5bdaa8c47ec57a9c576cce41f3bbd9b2a5d0f52` in isolated `verify-9-8-5-final/volleytime`. Player index and interaction test remain exact reviewed bytes; only this additive owning-card checkpoint differs. The eight accepted main timing-policy files and already-integrated rollback fixture remain unchanged. Original RED eight trailing failures → GREEN 72 cases and the historical failed typecheck/full image-bundle gates remain preserved evidence; they are not new target outcomes.

Five new gates run individually on frozen tracked bytes with cached pnpm 12.4.1 `with current`, exact PostgreSQL container `4329cfe8659eccf2e13ac3f4fe18b8e0d270d6767dd6439ad5f8bdc213a27d36` and `volleytime_test`. A distinct target output build is permitted after fresh read-only directory/reparse/output and listener/process checks, including preservation of original source/output; an original user runtime on 3317 does not authorize stopping it or rebuilding its output. Target evidence: `output/playwright/integration-8113`; outcomes belong to the integration report after gates finish.

Status remains `in_progress`: scoped independent integration review and exact-head CI/PR/merge are controller-owned. Existing final original real-API Chrome/native 200% evidence is preserved without repeating browser QA. Final source-equivalence to `22c0850`, integrated-main release gates/review/CI, production promotion/deploy and Telegram/pilot acceptance remain separate; neither 9.8.11 nor the release/manual acceptance is closed here.
