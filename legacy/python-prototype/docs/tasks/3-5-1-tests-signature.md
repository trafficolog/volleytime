---
id: "3.5.1"
phase: 3
epic: "3.5"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - QA
depends_on:
  - "3.4.1"
estimated_hours: "1-2"
tags:
  - tests
  - bepaid
  - signature
---

# Task 3.5.1: Тесты verify_bepaid_signature

## Цель

Юнит-тесты функции проверки RSA-подписи webhook. Цель — гарантировать, что валидная подпись принимается, невалидная отклоняется, отсутствие ключа — обрабатывается корректно.

## Контекст

Сама функция уже была в Phase 1 (Epic 1.4), но без тестов. В Phase 3 она становится критичной (Task 3.4.1), нужны тесты.

## Что должно быть сделано

- В `tests/conftest.py` хелпер `bepaid_keypair()`:
  - Генерирует RSA-пару (2048 бит) через `cryptography`
  - Возвращает `(private_key, public_key_pem_bytes)`
- В `tests/test_bepaid_signature.py`:
  - **test_valid_signature_accepted**: подписываем тело приватным ключом → `verify_bepaid_signature(body, sig, public_pem) == True`
  - **test_invalid_signature_rejected**: меняем один байт в подписи → `verify_bepaid_signature` возвращает False
  - **test_tampered_body_rejected**: подписали body1, передаём body2 → False
  - **test_wrong_algorithm_rejected**: подпись через SHA256 вместо SHA1 → False (bePaid использует SHA1 — это их спецификация)
  - **test_invalid_pem_raises**: невалидный PEM → исключение
  - **test_invalid_base64_signature_rejected**: подпись не в base64 → False (graceful, без crash)

## Критерии приёмки

- 6+ тестов проходят
- Тестовые ключи генерируются в conftest, не в репозитории
- Покрытие функции `verify_bepaid_signature` 100%

## Подсказки

- Подпись для теста:
  ```python
  from cryptography.hazmat.primitives import hashes, padding
  signature = private.sign(body, padding.PKCS1v15(), hashes.SHA1())
  signature_b64 = base64.b64encode(signature).decode()
  ```
- В тесте `pytest.raises(InvalidSignature)` или просто `assert result is False`, в зависимости от того, как мы решили обрабатывать в реализации.

## Не делать

- Не тестировать стандартную библиотеку `cryptography` — она протестирована.
- Не делать e2e через реальный aiohttp в этом таске (это в 3.5.3).
