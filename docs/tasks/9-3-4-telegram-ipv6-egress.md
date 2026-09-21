---
id: '9.3.4'
phase: '9'
epic: '9.3'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'IPv6 egress acceptance passed, but the card remains open because its webhook-installed criterion is intentionally unmet while production uses the approved polling fallback after IPv4 ingress failure.'
roles:
  - DEVOPS
  - QA
depends_on:
  - '9.3.2'
estimated_hours: '1'
tags:
  - telegram
  - ipv6
  - docker
  - production
---

# Task 9.3.4: Telegram egress через IPv6 из Docker

## Цель

Обеспечить стабильный исходящий доступ production bot-контейнера к `api.telegram.org`, когда Telegram IPv4 недоступен в сети VPS, но IPv6 работает.

## Диагноз

- `api.telegram.org` резолвится в `149.154.166.110` и `2001:67c:4e8:f004::9`.
- С VPS запрос с `--resolve api.telegram.org:443:149.154.166.110` завершается timeout.
- С VPS запрос к конкретному IPv6 с тем же TLS hostname отвечает HTTP 302 примерно за 0,1 секунды.
- Текущая production Docker network имеет только IPv4; контейнер получает `Network unreachable` для IPv6.
- Во временной Docker network с `--ipv6` tokenless Node `fetch` с `--dns-result-order=ipv6first` получает HTTP 200.

## Что должно быть сделано

1. Включить IPv6 для production `backend` network в compose.
2. Для bot задать Node DNS order `ipv6first`, не меняя URL Telegram API и TLS hostname.
3. Добавить контрактный тест compose-конфигурации.
4. После deploy подтвердить из bot image доступ к конкретному Telegram IPv6 и успешный startup с новым token.

## Критерии приёмки

- [x] `backend` создаётся dual-stack и выдаёт контейнерам IPv6.
- [x] Bot предпочитает IPv6 при DNS lookup.
- [x] Tokenless Node fetch из production network получает HTTP 200 от `api.telegram.org`.
- [ ] Bot healthy, webhook установлен, restart count стабилен.

## Не делать

- Не отключать TLS verification и не обращаться к Telegram API по IP без SNI hostname.
- Не добавлять публичный proxy без отдельной security-задачи.
- Не перезапускать Docker daemon: user-defined IPv6 network уже подтверждена без daemon-wide изменений.

## Production evidence — 2026-09-21

- Concrete Telegram IPv4 `149.154.166.110` remains unreachable from the VPS; concrete IPv6 `2001:67c:4e8:f004::9` succeeds with the Telegram TLS hostname from the production network.
- The bot is healthy and processes updates in `polling` mode; `getWebhookInfo` deliberately reports an empty URL and zero pending updates. The remaining webhook-installed subcriterion belongs to the unresolved provider IPv4 ingress path, not the working polling transport.
