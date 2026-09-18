---
id: "3.4.1"
phase: 3
epic: "3.4"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - WEB
depends_on: []
estimated_hours: "1"
tags:
  - security
  - bepaid
  - webhook
---

# Task 3.4.1: Жёсткая проверка RSA-подписи webhook

## Цель

Перевести `verify_bepaid_signature` из режима «warning при отсутствии ключа» в режим «hard fail»: без `BEPAID_PUBLIC_KEY_PATH` в `.env` сервер не стартует. Webhook без `Content-Signature` или с неверной подписью → 403, без обработки.

## Контекст

В Phase 1 (Epic 1.4) функция уже написана и работает. В Phase 1 она была мягкой — для удобства разработки. В Phase 3 переключаемся на «параноидальный» режим.

## Что должно быть сделано

- В `src/config.py` поле `bepaid_public_key_path: Path | None` стало `bepaid_public_key_path: Path | None = None`, но добавляется проверка при `__post_init__` / валидатор:
  - Если `bepaid_card_enabled or bepaid_erip_enabled` — `bepaid_public_key_path` обязателен.
  - Файл должен существовать, иначе `ValueError("Public key file not found: ...")` при загрузке settings
- В `src/web/bepaid_webhook.py`:
  - При startup загрузить публичный ключ один раз в память (`load_pem_public_key`)
  - В обработчике webhook:
    - Если нет заголовка `Content-Signature` → 403, лог `event="webhook_missing_signature"`
    - Если подпись не сходится → 403, лог `event="webhook_bad_signature"`
    - Иначе → продолжить обработку
- Никаких «soft»-режимов с warning. Только 403.

## Критерии приёмки

- Тест: запуск aiohttp без `BEPAID_PUBLIC_KEY_PATH` при включённых bePaid-методах → исключение
- Тест: запрос без заголовка `Content-Signature` → 403
- Тест: запрос с правильной подписью → 200
- Тест: запрос с неверной подписью → 403, в логах `event="webhook_bad_signature"`
- Тестовая RSA-пара генерируется в `conftest.py` через `cryptography`

## Подсказки

- Уже есть `cryptography` в зависимостях.
- Тестовая пара:
  ```python
  from cryptography.hazmat.primitives.asymmetric import rsa
  private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
  public = private.public_key()
  ```
- Подпись = `private.sign(body, padding.PKCS1v15(), hashes.SHA1())`, в заголовок — `base64.b64encode(signature).decode()`.

## Не делать

- Не отправлять admin-уведомление при каждом 403 — иначе спам при атаке.
- Не пытаться декодировать body, если подпись не прошла.
- Не использовать `eval` или `exec` на строковом представлении ключа — только бинарный PEM.
