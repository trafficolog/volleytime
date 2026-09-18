---
id: "3"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: "Заблокирован Треком A (регистрация ИП/НПД и подключение bePaid). Все 5 эпиков и 15 задач описаны и готовы к реализации."
---

# Phase 3: Интеграция bePaid

**Цель.** Автоматический приём оплат картой и через ЕРИП. Полное снятие ручного подтверждения админом для онлайн-платежей.

## Контекст

После Phase 2 бот умеет работать с ручной оплатой (наличные, перевод на карту с подтверждением админом). Phase 3 заменяет этот цикл на автоматический: игрок жмёт «Оплатить картой» → переходит на hosted page bePaid → оплачивает → webhook приходит к нам → бронь/абонемент активируются автоматически.

Ручная оплата (cash) остаётся как fallback — для тех, кто предпочитает заплатить на тренировке.

## Предусловия

- ✅ Phase 1 завершена
- ✅ Phase 2 завершена
- ⏸ **Трек A — Юридическая часть:**
  - Зарегистрированы как ИП или самозанятый (НПД) в РБ
  - Получено письменное разъяснение МНС (если запрашивали)
- ⏸ **Подключение к bePaid:**
  - Подана анкета мерчанта
  - Подписан договор
  - Получены `Shop ID`, `Secret Key`, публичный RSA-ключ (PEM)
  - Создан landing с офертой
- ⏸ **Инфраструктура:**
  - Куплен домен с HTTPS-сертификатом (Let's Encrypt через Caddy)
  - В личном кабинете bePaid указан `notification_url = https://yourbot.example/webhooks/bepaid`
  - Доступ к тестовой среде bePaid (флаг `test: true`)

## Definition of Done

- В тестовом режиме bePaid: запись → оплата картой → webhook → подтверждение брони полностью автоматическое, без участия админа
- В тестовом режиме bePaid: покупка абонемента → оплата → активация автоматическая
- ЕРИП работает (или сознательно отложен с TODO)
- Дублированный webhook не создаёт двойную запись в кассе (идемпотентность)
- Webhook с неверной подписью получает 403
- Refund при отмене тренировки админом уходит обратно на карту через bePaid API
- Все секреты (Secret Key, путь к публичному ключу) — в `.env`, не в коде
- В логах ни разу не появляется `BEPAID_SECRET_KEY` или содержимое тела webhook с PAN

## Эпики

| ID | Эпик | Статус |
|----|------|--------|
| [3.1](../epics/3-1-bepaid-service.md) | Сервис bePaid | todo |
| [3.2](../epics/3-2-webhook-handling.md) | Приём и обработка webhook | todo |
| [3.3](../epics/3-3-payment-ux.md) | UX оплаты | todo |
| [3.4](../epics/3-4-security.md) | Безопасность | todo |
| [3.5](../epics/3-5-tests-phase3.md) | Тесты Phase 3 | todo |

## Технические заметки

### Архитектура

```
Telegram Bot --> BePaidClient --> bePaid API
       |                              |
       | payment_url                  |
       v                              | POST webhook
   User browser --> hosted page       v
                                aiohttp /webhooks/bepaid
                                      | verify signature (RSA-SHA1)
                                      | check idempotency
                                      | PaymentService.confirm / fail
                                      v
                                  Database
```

### Сервис

`src/services/bepaid.py` — клиент с HTTP Basic Auth.

Точки API:
- `POST https://checkout.bepaid.by/ctp/api/checkouts` — создание checkout
- `POST https://api.bepaid.by/transactions/{uid}/refunds` — refund

### Webhook

`src/web/bepaid_webhook.py` — уже есть скелет с проверкой RSA-подписи (Phase 1, Epic 1.4). Phase 3 наполняет его реальной обработкой и подключает к `PaymentService`.

### Безопасность

- **Проверка подписи Content-Signature** — обязательна. Без публичного ключа сервер не стартует.
- **Идемпотентность по `bepaid_uid`** — уникальный индекс уже есть в модели (Phase 1).
- **Allowlist IP** — опционально, второй слой защиты.
- **Logging redaction** — не логировать `Authorization`, `cardholder_name`, `pan` (даже маскированный).

### Тестовая среда

В bePaid поддерживается флаг `"test": true` в payload checkout. Полный цикл (создание → оплата на тестовой карте → webhook) работает без реальных списаний.

Тестовые карты:
- `4200 0000 0000 0000` — успех
- `4012 8888 8888 1881` — declined
- CVV — любой 3-значный, expiry — будущий месяц

## Связанные документы

- [BEPAID.md](../BEPAID.md) — техническая интеграция, чек-лист подключения
- [TAXES_BY.md](../TAXES_BY.md) — что нужно сделать в МНС до этой фазы
- [ARCHITECTURE.md](../ARCHITECTURE.md) — поток данных через webhook
