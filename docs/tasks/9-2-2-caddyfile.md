---
id: '9.2.2'
phase: '9'
epic: '9.2'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 9.9.'
roles:
  - DEVOPS
depends_on:
  - '9.2.1'
estimated_hours: '1-2'
tags:
  - caddy
  - https
  - reverse-proxy
---

# Task 9.2.2: Caddyfile (HTTPS, reverse proxy, webhook routing)

## Цель

Caddyfile: auto-HTTPS (Let's Encrypt), проксирование volleytime.by → web, /tg/webhook/* → bot. Безопасные заголовки.

## Контекст

Решения 3, 5, 6: Mini App на корне, webhook на секретном пути, Caddy auto-HTTPS. Caddy — единственная точка входа, терминирует TLS, маршрутизирует.

## Что должно быть сделано

1. **`Caddyfile`:**

   ```
   volleytime.by {
       # Auto-HTTPS через Let's Encrypt (Caddy сам получает/продлевает)

       # Telegram webhook → bot (секретный путь из env)
       handle_path /tg/webhook/* {
           reverse_proxy bot:8443
       }

       # Всё остальное → web (Nuxt, Mini App + веб)
       handle {
           reverse_proxy web:3000
       }

       # Безопасные заголовки
       header {
           # Mini App в iframe Telegram — НЕ ставить X-Frame-Options DENY
           Strict-Transport-Security "max-age=31536000;"
           X-Content-Type-Options "nosniff"
           Referrer-Policy "strict-origin-when-cross-origin"
           -Server
       }

       encode gzip zstd
   }
   ```

2. **Webhook путь:** секрет в пути. Caddy `handle_path` со static-путём, либо env-подстановка. Caddy v2 поддерживает env-переменные `{$WEBHOOK_SECRET_PATH}`:

   ```
   handle_path /tg/webhook/{$WEBHOOK_SECRET_PATH}/* {
       reverse_proxy bot:8443
   }
   ```

   (передать WEBHOOK_SECRET_PATH в caddy контейнер через environment)

3. **Важно про X-Frame-Options:** Mini App открывается в Telegram (iframe/webview). НЕ ставить `X-Frame-Options: DENY` — иначе Telegram не отрендерит. HSTS, nosniff — ок.

4. **HTTP → HTTPS:** Caddy авто-редиректит 80→443.

5. **Проверка:**
   - https://volleytime.by → Nuxt (Mini App)
   - https://volleytime.by/tg/webhook/<secret> → bot (Telegram updates)
   - HTTP редиректит на HTTPS
   - Сертификат Let's Encrypt валиден

## Критерии приёмки

- ✅ Auto-HTTPS (Let's Encrypt) работает, сертификат валиден
- ✅ volleytime.by → web:3000
- ✅ /tg/webhook/<secret>/* → bot:8443
- ✅ HTTP → HTTPS редирект
- ✅ Безопасные заголовки (HSTS, nosniff), БЕЗ X-Frame-Options DENY (Mini App)
- ✅ gzip/zstd сжатие
- ✅ Webhook путь из env (секрет не хардкод)

## Подсказки

- **Caddy auto-HTTPS zero-config** — указал домен, Caddy получает сертификат сам (нужен порт 80/443 доступен, DNS настроен — 9.4). Магия Caddy.
- **X-Frame-Options НЕЛЬЗЯ DENY** — Mini App в Telegram webview. Если поставить — белый экран в Telegram. Распространённая ошибка.
- **handle_path срезает префикс** — bot получает путь без /tg/webhook/secret. Учесть в bot webhook handler (9.5.1) — путь, который ожидает grammY.
- **env в Caddyfile** — `{$VAR}` подставляется из environment контейнера caddy. Передать WEBHOOK_SECRET_PATH.
- **Сертификат в volume** (caddy_data, 9.2.1) — не теряется при рестарте, не упирается в Let's Encrypt rate limit.

## Не делать

- ❌ Не ставить X-Frame-Options DENY (ломает Mini App)
- ❌ Не хардкодить webhook секрет в Caddyfile
- ❌ Не использовать self-signed (Telegram требует валидный)
- ❌ Не терять caddy_data volume (rate limit Let's Encrypt)
