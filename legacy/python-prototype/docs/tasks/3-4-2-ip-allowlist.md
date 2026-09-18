---
id: "3.4.2"
phase: 3
epic: "3.4"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: "Опционально. Включается через флаг в .env."
roles:
  - WEB
  - DEVOPS
depends_on: []
estimated_hours: "1"
tags:
  - security
  - bepaid
  - opt-in
---

# Task 3.4.2: Allowlist IP-адресов bePaid

## Цель

Дополнительный слой защиты: проверять, что webhook пришёл с IP-адресов bePaid. Список IP стабилен (выдаётся в кабинете bePaid). Опционально — включается через флаг.

## Контекст

Подпись RSA — основной слой. IP-allowlist — второй, на случай если приватный ключ магазина утечёт (хотя у нас его быть не должно — у нас только публичный). Защищает от ситуаций, когда какой-то злоумышленник смог получить и публичный, и приватный ключ и пытается слать webhook напрямую к нам.

## Что должно быть сделано

- В `src/config.py`:
  - `bepaid_ip_allowlist: list[str] = []` (пустой список = выключено)
- В `src/web/bepaid_webhook.py`:
  - Middleware aiohttp `ip_allowlist_middleware`:
    - Если `bepaid_ip_allowlist` пустой — пропускаем (выключено)
    - Иначе извлекаем IP клиента: учитываем `X-Forwarded-For` (если за Caddy/nginx)
    - Если не в списке → 403, лог `event="webhook_ip_not_allowed" ip=X`
- Документировать в OPERATIONS.md как узнать IP bePaid и где включить

## Критерии приёмки

- Тест: при пустом allowlist webhook от любого IP проходит проверку (если подпись ОК)
- Тест: при включённом allowlist webhook не из списка → 403
- Учёт `X-Forwarded-For` (берём первый IP из цепочки)

## Подсказки

- bePaid IP-адреса публикуются в их доке/кабинете. Сюда не вписываю реальные адреса — может меняться.
- Caddy и nginx по умолчанию добавляют `X-Forwarded-For`.
- Для теста использовать `aiohttp.web.Request.remote` или `request.headers.get("X-Forwarded-For")`.

## Не делать

- Не реализовывать allowlist через IP-диапазоны (CIDR) в первой версии — простой список достаточно.
- Не отправлять admin-уведомление при каждом отказе.
- Не парсить IPv6 в этой задаче (если bePaid использует только IPv4).
