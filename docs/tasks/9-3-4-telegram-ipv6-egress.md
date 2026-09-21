---
id: '9.3.4'
phase: '9'
epic: '9.3'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Concrete-IP IPv6/SNI, normal Bot API, dual-stack container, DNS preference, health and restart stability passed in production; webhook ingress remains isolated in Task 9.5.1.'
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
- [x] Bot healthy в утверждённом production transport, restart count стабилен.

Webhook installation не является egress-критерием: прямой Telegram ingress отслеживается Task 9.5.1 и остаётся открытым. Закрытие этой карточки подтверждает только исходящий Bot API transport и не объявляет webhook работающим.

## Не делать

- Не отключать TLS verification и не обращаться к Telegram API по IP без SNI hostname.
- Не добавлять публичный proxy без отдельной security-задачи.
- Не перезапускать Docker daemon: user-defined IPv6 network уже подтверждена без daemon-wide изменений.

## Production evidence — 2026-09-21

- Concrete Telegram IPv4 `149.154.166.110` remains unreachable from the VPS; concrete IPv6 `2001:67c:4e8:f004::9` succeeds with the Telegram TLS hostname from the production network.
- The bot is healthy and processes updates in `polling` mode; `getWebhookInfo` deliberately reports an empty URL and zero pending updates. The remaining webhook-installed subcriterion belongs to the unresolved provider IPv4 ingress path, not the working polling transport.
- Fresh concrete-IP probes from `vt_bot` preserved `servername=api.telegram.org` and the HTTP Host header: IPv6 returned `302`, while IPv4 timed out and reset as expected; normal `https://api.telegram.org` returned `200`.
- `vt_bot` had backend IPv6 `fd3f:fc9a:f0f4::3`, `NODE_OPTIONS=--dns-result-order=ipv6first`, restart count `0`, health `ok`, mode `polling` and release `16c2fe422db94bc97c085201a6cf9fcc919b7b72`.
- `getWebhookInfo` returned `ok=true`, empty URL, zero pending updates and no last error. This proves a clean polling state, not webhook ingress.
