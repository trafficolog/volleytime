---
id: "3.4.3"
phase: 3
epic: "3.4"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - DEVOPS
depends_on: []
estimated_hours: "1-2"
tags:
  - security
  - logging
  - privacy
---

# Task 3.4.3: Redaction чувствительных данных в логах

## Цель

Гарантировать, что в логах никогда не появляется: `BEPAID_SECRET_KEY`, заголовок `Authorization`, полные данные карт (`pan`, `cvv`, `cardholder_name`, expiry), даже если они случайно попадут в payload bePaid или в исключение.

## Контекст

Утечка в логах — частая причина инцидентов. Защита: фильтр на уровне `structlog` (или стандартного `logging`), который автоматически маскирует поля с известными именами.

## Что должно быть сделано

- Создать процессор для structlog `redact_sensitive(logger, method_name, event_dict)`:
  - Список запрещённых ключей: `authorization`, `secret_key`, `bepaid_secret_key`, `pan`, `card_number`, `cvv`, `cardholder_name`, `expiry`
  - Если ключ есть на любом уровне вложенности — заменить на `<REDACTED>`
  - Также маскировать значения, похожие на PAN-карты: 13-19 цифр подряд → `XXXX-XXXX-XXXX-XXXX`
- Подключить процессор в `src/utils/logging.py` (новый модуль, если ещё нет)
- В webhook handler (Task 3.2.3) — никогда не логировать полное тело `await request.read()`. Только парсенные поля.
- Самопроверка: добавить тест, который пишет в лог event с такими ключами и проверяет, что в выходе их нет.

## Критерии приёмки

- Тест: `log.info("event", authorization="Basic xxx")` → в выводе нет `Basic xxx`
- Тест: `log.info("event", body={"transaction": {"pan": "4111111111111111"}})` → в выводе `<REDACTED>` вместо номера
- Тест: строка `Authorization: Basic dGVzdDp0ZXN0` в свободной форме → маскируется
- Запуск бота → ни одной утечки секрета в stdout/stderr
- В `OPERATIONS.md` обновлён раздел «безопасность» с описанием redaction

## Подсказки

- structlog имеет встроенный механизм процессоров: `structlog.configure(processors=[..., redact_sensitive, ...])`
- Регексп для PAN: `r"\b\d{13,19}\b"` (грубо, можно улучшить алгоритмом Luhn).
- Маскирование `Basic <token>` в Authorization-заголовке: можно через `re.sub(r"Basic [a-zA-Z0-9+/=]+", "Basic <REDACTED>", value)`

## Не делать

- Не маскировать `bepaid_uid` или `tracking_id` — это не секреты.
- Не маскировать суммы или статусы — это нужно для отладки.
- Не делать redaction `telegram_id` пользователей — это нужно для поддержки.
