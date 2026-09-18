---
id: "3.4"
phase: 3
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: "Закрепляет защитные меры. Часть уже сделана в Phase 1 (Epic 1.4, проверка подписи), здесь ужесточаем."
---

# Epic 3.4: Безопасность

**Цель.** Жёсткая проверка подписи webhook (вместо текущей «soft» в Phase 1), allowlist IP-адресов bePaid как второй слой защиты, redaction чувствительных данных в логах.

## Контекст

В Phase 1 функция `verify_bepaid_signature` написана, но используется в режиме «warning, если не прошла». Phase 3 переводит её в режим «hard fail — 403».

Также добавляем:
- Allowlist IP — опционально (IP bePaid стабильны, список выдаётся в кабинете).
- Logging redaction — middleware aiohttp, которое вырезает Authorization-заголовок и любые поля, похожие на PAN, из логов.

## Definition of Done

- Без `BEPAID_PUBLIC_KEY_PATH` в `.env` сервер **не стартует** (raise on startup, а не warning)
- Webhook с отсутствующим `Content-Signature` → 403
- Webhook с неверной подписью → 403
- Webhook с правильной подписью, но IP не из allowlist (если включён) → 403
- В логах при включенном DEBUG не появляется содержимое заголовков `Authorization`, тела с полями `pan`, `cvv`, `cardholder`
- Чек-лист «что не должно попасть в Git» обновлён в OPERATIONS.md

## Задачи

| ID | Задача | Статус |
|----|--------|--------|
| [3.4.1](../tasks/3-4-1-strict-signature-check.md) | Жёсткая проверка подписи | todo |
| [3.4.2](../tasks/3-4-2-ip-allowlist.md) | Allowlist IP-адресов bePaid | todo |
| [3.4.3](../tasks/3-4-3-log-redaction.md) | Redaction чувствительных данных в логах | todo |

## Не делать

- **Не добавляем rate limiting на webhook** — bePaid сам ограничивает себя, наш сервер не будет завален.
- **Не добавляем CAPTCHA или анти-фрод**. Это работа bePaid.
- **Не шифруем данные в БД** сверх того, что уже есть (только `bepaid_uid` хранится — это не секрет).
