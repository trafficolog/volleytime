---
id: '9.3.6'
phase: '9'
epic: '9.3'
status: in_progress
sync_state: local
last_reviewed: 2026-09-20
status_note: 'Approved bounded fallback: use the existing outbound polling path for the low-load pilot while the hosting provider IPv4 route cannot receive Telegram webhooks.'
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

- [ ] Contract test сначала падает на hardcoded production `BOT_MODE: webhook`.
- [ ] Compose получает `BOT_MODE` из production env и сохраняет безопасный fallback для старых env.
- [ ] Renderer пишет `BOT_MODE="polling"` по умолчанию, принимает `webhook` и отклоняет другие значения.
- [ ] Deploy workflow передаёт `vars.PRODUCTION_BOT_MODE` renderer-у.
- [ ] Polling startup не сбрасывает pending updates.
- [ ] Focused test проходит после наблюдаемого RED.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` проходят.
- [ ] После production deploy bot healthy, mode=`polling`, pending webhook queue очищена через polling и реальный update обработан.
- [ ] Web/API health и точный release SHA остаются healthy.

## Не делать

- Не удалять webhook-код, Caddy route или webhook secrets.
- Не добавлять MTProxy для Bot API polling: доступный Telegram IPv6 уже подтверждён.
- Не использовать `drop_pending_updates=true`.
- Не объявлять прямой webhook исправленным: его acceptance остаётся открытым до восстановления IPv4 routing.
