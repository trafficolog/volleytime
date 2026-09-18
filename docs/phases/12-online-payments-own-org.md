---
id: '12'
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: 'bePaid интеграция — proof of concept для своей организации.'
estimated_hours: '30-40'
depends_on: ['10']
---

# Phase 12: Online Payments (own organization)

**Цель.** Подключить bePaid для **своей** организации Volley Time (как proof of concept). Игрок может оплатить тренировку или абонемент картой / ЕРИП через Mini App.

## Предусловия (юридические)

- ⏸ Регистрация ИП/НПД (РБ или РФ — финализировать по результатам Phase 10)
- ⏸ Договор с bePaid
- ⏸ Получены Shop ID, Secret Key, RSA public key

## Эпики (черновой план)

| ID   | Эпик                                                       | Задач |
| ---- | ---------------------------------------------------------- | ----: |
| 12.1 | BePaidClient: create_checkout, refund, get_transaction     |     4 |
| 12.2 | Webhook handler с RSA-проверкой подписи                    |     3 |
| 12.3 | Идемпотентность по bepaid_uid                              |     2 |
| 12.4 | UI: кнопки «Оплатить картой» / «ЕРИП» в Mini App           |     2 |
| 12.5 | Deeplink на bePaid checkout, return_url обратно в Telegram |     2 |
| 12.6 | Refund flow при отмене события                             |     2 |
| 12.7 | Log redaction для PCI-чувствительных данных                |     1 |
| 12.8 | Tests (signature, idempotency, e2e mock)                   |     4 |

## Definition of Done

- В тестовом режиме bePaid: запись → оплата картой → webhook → подтверждение брони автоматическое
- В тестовом режиме: покупка абонемента онлайн
- Дублирующиеся webhook не создают двойной income в ledger
- Refund возвращает деньги на карту через bePaid API
- Все секреты в env, не в коде
- В логах нет содержимого webhook payload (PCI compliance)

## Из Python-прототипа

Можно переиспользовать опыт:

- Структура BePaidClient
- RSA signature verification logic
- Idempotency через unique bepaid_uid
