---
id: '9.3.6'
phase: '9'
epic: '9.3'
status: done
sync_state: synced
last_reviewed: 2026-09-20
status_note: 'Production polling fallback deployed at e5e0c9e; four queued updates and the user-observed greeting responses prove live Telegram delivery.'
roles:
  - DEVOPS
  - QA
  - SECURITY
depends_on:
  - '9.3.5'
  - '9.5.1'
estimated_hours: '2'
tags:
  - telegram
  - polling
  - ipv6
  - production
  - fallback
---

# Task 9.3.6: Production polling fallback

## Дефект

Task 9.3.5 доказала внешний IPv4 routing blackhole: Telegram webhook retries не достигают публичного интерфейса VPS, хотя локальные UFW, Docker DNAT, Caddy и bot endpoint исправны. Telegram webhook не поддерживает IPv6, а исходящий Bot API через IPv6 работает.

Для пилота одной организации нужен рабочий Telegram update transport без ожидания исправления маршрута провайдером.

## Согласованный дизайн

1. Использовать существующую ветку `BOT_MODE=polling`: она удаляет webhook без `drop_pending_updates` и запускает grammY long polling.
2. Сделать production `BOT_MODE` параметром compose/env вместо hardcoded `webhook`.
3. Production env renderer по умолчанию выдаёт `polling`, принимает только `polling|webhook` и позволяет GitHub repository variable `PRODUCTION_BOT_MODE` вернуть webhook без изменения кода.
4. Сохранить webhook server, Caddy route и secrets: fallback обратим после восстановления IPv4-маршрута.
5. Не переносить MTProxy pool из TG Digest Agent: он решает исходящий MTProto, а не Bot API webhook ingress.

## Критерии приёмки

- [x] Contract test сначала падает на hardcoded production `BOT_MODE: webhook`.
- [x] Compose получает `BOT_MODE` из production env и сохраняет безопасный fallback для старых env.
- [x] Renderer пишет `BOT_MODE="polling"` по умолчанию, принимает `webhook` и отклоняет другие значения.
- [x] Deploy workflow передаёт `vars.PRODUCTION_BOT_MODE` renderer-у.
- [x] Polling startup не сбрасывает pending updates.
- [x] Focused test проходит после наблюдаемого RED.
- [x] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` проходят.
- [x] После production deploy bot healthy, mode=`polling`, pending webhook queue очищена через polling и реальный update обработан.
- [x] Web/API health и точный release SHA остаются healthy.

## Не делать

- Не удалять webhook-код, Caddy route или webhook secrets.
- Не добавлять MTProxy для Bot API polling: доступный Telegram IPv6 уже подтверждён.
- Не использовать `drop_pending_updates=true`.
- Не объявлять прямой webhook исправленным: его acceptance остаётся открытым до восстановления IPv4 routing.

## Локальные доказательства

- RED 1: focused deploy contract упал, потому что production renderer не выдавал `BOT_MODE="polling"`.
- RED 2: расширенный contract упал до документирования `PRODUCTION_BOT_MODE` и правил сохранения pending updates в runbook.
- GREEN: focused deploy contract — 17/17 тестов.
- Полные gates: `format:check` passed; `lint` — 0 errors (24 существующих warnings); `typecheck` — 6/6; `test` — 75 файлов, 409 тестов; `build` — 2/2 пакета.

## Production evidence

- PR #23 прошёл Build, Lint/Format/Typecheck и Test CI и был объединён в `main`; точный merge SHA `e5e0c9eccfa79f0cc4dcb387f0c43ab62fa9ce2e` fast-forward продвинут в `prod`.
- Deploy workflow #35510987693 завершился успешно; independent SSH readback показал тот же Git SHA и healthy `web`, `bot`, `postgres` containers.
- Public `https://volleytime.by/api/health` вернул `status=ok`, `db=ok`, `auth=ok` и точный release SHA.
- Bot `/healthz` вернул `status=ok`, `mode=polling` и точный release SHA; startup log содержит `starting in polling mode`.
- До deploy у Telegram было четыре pending updates. После запуска bot log содержит четыре успешно обработанных сообщения, пользователь подтвердил получение ответов-приветствий, а безопасный `getWebhookInfo` readback показал пустой webhook URL, `pending_update_count=0` и отсутствие last error.
