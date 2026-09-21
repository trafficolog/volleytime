---
id: '9.5.2'
phase: '9'
epic: '9.5'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'A marked production notification traversed vt_web to the protected bot internal endpoint and was accepted by Telegram; isolation, health and restart stability were re-verified.'
roles:
  - BACK
  - DEVOPS
depends_on:
  - '8.4.1'
estimated_hours: '1'
tags:
  - telegram
  - bot
  - notifier
---

# Task 9.5.2: Разделение webhook/internal listeners + env переключение

## Цель

Bot поднимает два независимых listener: webhook (:8443, публичный через Caddy) и internal notify (:3001, внутренняя сеть, из 8.4.1). Чёткое разделение, env-конфиг.

## Контекст

Решение 4: webhook (от Telegram) и internal notify (от web) — разные каналы. Webhook через Caddy наружу, internal notify только docker-сеть. Не путать порты/защиту.

## Что должно быть сделано

1. **Internal notify server** (из 8.4.1) — отдельный listener :3001:

   ```ts
   import { createServer } from 'node:http'
   import { env } from './env'
   import { handleNotify } from './notify'

   export function startInternalNotifyServer() {
     const server = createServer(async (req, res) => {
       if (req.method !== 'POST' || req.url !== '/internal/notify') {
         res.statusCode = 404
         res.end()
         return
       }
       // защита secret (внутренняя сеть + secret = двойная)
       if (req.headers['x-internal-secret'] !== env.BOT_INTERNAL_SECRET) {
         res.statusCode = 403
         res.end('Forbidden')
         return
       }
       try {
         const body = await readJsonBody(req)
         await handleNotify(body)
         res.statusCode = 200
         res.end('OK')
       } catch (e) {
         console.error('[internal-notify] error', e)
         res.statusCode = 500
         res.end()
       }
     })
     server.listen(3001, () => console.log('[bot] internal notify :3001'))
   }
   ```

2. **Запуск обоих в webhook режиме** (`index.ts`, расширение 9.5.1):

   ```ts
   if (env.BOT_MODE === 'webhook') {
     await registerWebhook()
     startWebhookServer() // :8443 публичный
     startInternalNotifyServer() // :3001 внутренний
   } else {
     bot.start() // polling
     startInternalNotifyServer() // :3001 — нужен и в dev (web шлёт уведомления)
   }
   ```

   Internal notify нужен и в dev (web→bot уведомления работают локально).

3. **docker-compose сети (9.2.1) подтверждение:**
   - :8443 — frontend сеть (Caddy проксирует)
   - :3001 — backend сеть (web→bot), наружу не публикуется
   - Оба порта НЕ в `ports:` (8443 через caddy, 3001 внутренний)

4. **Env:** BOT_INTERNAL_SECRET (общий с web), порты опц через env (дефолты 8443/3001).

5. **Проверка:**
   - Webhook: Telegram → Caddy → bot:8443 → ответ
   - Internal: web → bot:3001/internal/notify (внутри docker) → уведомление отправлено
   - bot:3001 НЕ доступен снаружи VPS

## Критерии приёмки

- [x] Два listener: webhook :8443, internal notify :3001.
- [x] Internal notify защищён secret (403 при неверном).
- [x] В webhook режиме оба стартуют.
- [x] В dev и production polling internal notify работает независимо от Telegram ingress transport.
- [x] :3001 не публикуется наружу (только backend docker-сеть).
- [x] :8443 через Caddy (frontend сеть).
- [x] Уведомления (8.5) доставляются в production.

Task 9.5.1 не является runtime dependency для internal notify: webhook и polling взаимоисключающе выбирают Telegram ingress, а `web → bot:3001 → Telegram API` запускается в обоих режимах. Прямой webhook ingress остаётся отдельным открытым gate.

## Production E2E evidence — 2026-09-21

- В production найдены два активных пользователя с Telegram identity; идентификаторы и другие PII не выводились.
- Запрос из `vt_web` к `/internal/notify` с заведомо неверным secret вернул `403 Forbidden` и не отправил сообщение.
- Один маркированный запрос из `vt_web` с production internal secret прошёл реальный путь `web → bot:3001 → bot.api.sendMessage → Telegram` и вернул `200 OK`. Endpoint отвечает `200` только после успешного `await bot.api.sendMessage`; Telegram/API ошибка вернула бы `500`.
- Тестовое сообщение явно сообщало, что это автоматическая production-проверка и действий не требуется.
- После отправки `vt_bot` сообщил health `ok`, mode `polling`, restart count `0`; Docker показал `3001/tcp` и `8443/tcp` без published host ports.
- Focused notifier/internal/config regression: 4 files, 24 tests passed. Значения secret и Telegram IDs не попали в evidence.

## Подсказки

- **Internal notify нужен в обоих режимах** — web шлёт уведомления и в dev, и в prod. Только webhook/polling переключается, internal listener всегда.
- **Двойная защита internal:** внутренняя сеть (не доступен снаружи) + secret (на случай если кто-то внутри сети). Defense in depth.
- **Порты не в ports:** (9.2.1) — 8443 идёт через caddy reverse_proxy, 3001 по имени bot:3001 внутри сети. Прямой публикации нет.
- **readJsonBody helper** — распарсить тело POST (node http не парсит сам).

## Не делать

- ❌ Не публиковать :3001 наружу
- ❌ Не смешивать webhook и internal на одном порту
- ❌ Не отключать internal notify в dev (уведомления сломаются локально)
- ❌ Не убирать secret-проверку internal
