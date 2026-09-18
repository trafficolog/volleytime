# Интеграция с bePaid

Документация по подключению и работе с белорусским эквайером bePaid (bepaid.by).

## Что такое bePaid

bePaid — платёжный сервис, обслуживающий карты `Visa`, `Mastercard`, `БЕЛКАРТ` и **ЕРИП** в Республике Беларусь. Принадлежит банку «Решение». Документация: [docs.bepaid.by](https://docs.bepaid.by/).

## Что нужно для подключения

1. **ИП или юрлицо.** Физлицу мерчантский аккаунт не открывают. См. [TAXES_BY.md](./TAXES_BY.md).
2. **Расчётный счёт** в белорусском банке.
3. **Анкета мерчанта** + учредительные документы.
4. **Договор с bePaid** — подписывается в офисе или электронно.
5. **Сайт с публичной офертой** — даже минимальный.
6. **HTTPS-домен для приёма webhooks** — без HTTPS bePaid не работает.

Срок подключения — от 3 до 14 рабочих дней.

## После подключения вы получаете

- **Shop ID** — числовой идентификатор магазина.
- **Secret Key** — закрытый ключ для HTTP Basic Auth.
- **Public Key (PEM)** — публичный RSA-ключ магазина для проверки вебхуков.
- Доступ к личному кабинету `merchant.bepaid.by`.
- Доступ к тестовой среде (флаг `test: true` в запросах).

## Архитектура интеграции

```
┌──────────────┐                          ┌──────────────┐
│ Telegram Bot │ ───── POST checkout ───► │  bePaid API  │
│   (наш)      │                          │              │
│              │ ◄──── payment_url ─────  │              │
└──────┬───────┘                          └──────┬───────┘
       │                                         │
       │ кнопка с URL                            │
       ▼                                         │
┌──────────────┐         redirect                │
│ User Browser │ ───────────────────────────────►│
│  (карта)     │                                 │
└──────────────┘                                 │
                                                 │ POST webhook
                                                 ▼
                                          ┌──────────────┐
                                          │ aiohttp web  │
                                          │ /webhooks/   │
                                          │  bepaid      │
                                          └──────────────┘
```

## Поток оплаты (одиночная)

### Шаг 1. Создание payment_token

```http
POST https://checkout.bepaid.by/ctp/api/checkouts
Authorization: Basic base64(SHOP_ID:SECRET_KEY)
Content-Type: application/json

{
  "checkout": {
    "test": true,
    "transaction_type": "payment",
    "order": {
      "currency": "BYN",
      "amount": 1500,
      "description": "Тренировка 30.05.2026",
      "tracking_id": "payment_42",
      "expired_at": "2026-05-30T18:00:00Z"
    },
    "settings": {
      "language": "ru",
      "notification_url": "https://yourbot.example/webhooks/bepaid",
      "return_url": "https://t.me/your_bot",
      "payment_method": {
        "types": ["credit_card", "erip"]
      }
    },
    "customer": {
      "email": "player@example.com"
    }
  }
}
```

**Важно:**
- `amount` — в копейках (15.00 BYN = 1500).
- `tracking_id` — наш внутренний `Payment.id`, по которому матчим вебхук.
- `notification_url` — куда bePaid пришлёт уведомление.

Ответ:
```json
{
  "checkout": {
    "token": "abcd1234...",
    "redirect_url": "https://checkout.bepaid.by/v2/checkout?token=abcd1234..."
  }
}
```

### Шаг 2. Пользователь оплачивает

Пользователь переходит на bePaid hosted page, вводит данные карты или выбирает ЕРИП. PCI DSS снимается с нас.

### Шаг 3. Webhook

```http
POST /webhooks/bepaid
Authorization: Basic base64(SHOP_ID:SECRET_KEY)
Content-Signature: <base64 RSA-SHA1 подпись тела>
Content-Type: application/json

{
  "transaction": {
    "uid": "12345-67890-abc",
    "status": "successful",
    "amount": 1500,
    "currency": "BYN",
    "tracking_id": "payment_42",
    "type": "payment",
    "payment_method_type": "credit_card"
  }
}
```

### Шаг 4. Обработка webhook

```python
async def handle_bepaid_webhook(request):
    body = await request.read()
    signature = request.headers["Content-Signature"]

    # 1. Проверка подписи
    if not verify_bepaid_signature(body, signature, PUBLIC_KEY):
        return web.Response(status=403)

    payload = json.loads(body)
    tx = payload["transaction"]

    # 2. Идемпотентность
    existing = await get_payment_by_bepaid_uid(tx["uid"])
    if existing and existing.status == PaymentStatus.succeeded:
        return web.Response(status=200, text="already processed")

    # 3. Обновляем платёж
    payment = await get_payment_by_tracking_id(tx["tracking_id"])
    payment.bepaid_uid = tx["uid"]
    payment.bepaid_status = tx["status"]

    if tx["status"] == "successful":
        await PaymentService(session).confirm(payment.id)

    elif tx["status"] in ("failed", "error"):
        await PaymentService(session).fail(payment.id, reason=tx["status"])

    return web.Response(status=200)
```

## Проверка RSA-подписи

bePaid подписывает тело каждого webhook'а **приватным** ключом магазина. Публичный ключ лежит у вас.

```python
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

def verify(body: bytes, signature_b64: str, public_key_pem: bytes) -> bool:
    public_key = serialization.load_pem_public_key(public_key_pem)
    signature = base64.b64decode(signature_b64)
    try:
        public_key.verify(signature, body, padding.PKCS1v15(), hashes.SHA1())
        return True
    except InvalidSignature:
        return False
```

**Без проверки подписи** любой, кто узнал URL вашего webhook, может прислать «успешный платёж».

## Идемпотентность

bePaid может прислать одно и то же событие 2-3 раза. Защита:

1. Уникальный индекс на `Payment.bepaid_uid`.
2. Перед обработкой проверять текущий статус `Payment`. Если уже `succeeded` — просто вернуть 200.

## Особенности ЕРИП

ЕРИП — единая расчётная и информационная система НБРБ. Через ЕРИП клиент может оплатить через своё мобильное банкинг-приложение (Беларусбанк, Приорбанк, и т. п.), не вводя данные карты.

В bePaid ЕРИП подключается как ещё один тип в `payment_method.types: ["credit_card", "erip"]`.

## Возвраты (refund)

```http
POST https://api.bepaid.by/transactions/{parent_uid}/refunds
Authorization: Basic ...
Content-Type: application/json

{
  "request": {
    "amount": 1500,
    "reason": "Cancellation by admin"
  }
}
```

## Тестовая среда

Тестовые карты:
- `4200 0000 0000 0000` — успех
- `4012 8888 8888 1881` — declined
- CVV — любой 3-значный.
- Expiry — любой будущий месяц.

## Чек-лист подключения

- [ ] Зарегистрирован ИП / самозанятость
- [ ] Открыт расчётный счёт (для ИП)
- [ ] Подана анкета на bePaid
- [ ] Создан landing с офертой
- [ ] Получены Shop ID + Secret Key + публичный ключ
- [ ] Куплен домен, получен Let's Encrypt сертификат
- [ ] В личном кабинете bePaid указан notification_url
- [ ] Прошёл тестовый платёж в `test: true`
- [ ] Запущен production, прошёл первый реальный платёж

## Ссылки

- [Документация bePaid (RU)](https://docs.bepaid.by/ru/)
- [Hosted Payment Page](https://docs.bepaid.by/ru/integration/widget/payment_page/)
- [Webhook notifications](https://docs.bepaid.by/en/using_api/webhooks/)
- [ЕРИП интеграция](https://docs.bepaid.by/en/payment_methods/apms/erip/)
- [Личный кабинет bePaid](https://merchant.bepaid.by/)
