# 💳 bePaid Integration

> **Last updated:** 2026-05-25
> Подключение онлайн-оплаты через bePaid (Беларусь) для оплат картой и ЕРИП. Phase 12-13.

---

## Когда

- **Phase 12:** bePaid для **своей** организации Volley Time как proof of concept.
- **Phase 13:** превращение в подключаемый add-on для любого организатора.

До Phase 12 — оплаты только cash/transfer с ручным подтверждением.

---

## Что такое bePaid

[bePaid](https://bepaid.by) — белорусский payment gateway. Принимает:

- Карты (Visa, MasterCard, БЕЛКАРТ)
- ЕРИП (через банк-клиент)
- Yandex Pay, Apple Pay, Google Pay

Hosted checkout page — игрок переходит на bePaid, вводит данные карты, возвращается обратно.

Webhook — bePaid уведомляет нас о результате транзакции.

---

## Регистрация мерчанта (предусловие Phase 12)

### Шаги

1. Заявка на сайте bePaid (требует юр.лицо или ИП)
2. Договор с bePaid
3. Получение:
   - **Shop ID** (числовой)
   - **Secret Key** (HMAC для подписи запросов)
   - **Public RSA Key** (для верификации webhook)

### Тестовая среда

Доступна сразу. Параметры:

- API: `https://checkout.bepaid.by/ctp/api/checkouts` с флагом `"test": true`
- Тестовые карты:
  - `4200 0000 0000 0000` — успех
  - `4012 8888 8888 1881` — declined
  - CVV — любые 3 цифры, дата — будущая

### Production

После live-режима — никаких тестовых карт, всё с реальных счетов.

---

## API: создание checkout

### Endpoint

```
POST https://checkout.bepaid.by/ctp/api/checkouts
Authorization: Basic base64(shop_id:secret_key)
Content-Type: application/json
```

### Payload (упрощённо)

```json
{
  "checkout": {
    "test": false,
    "transaction_type": "payment",
    "order": {
      "amount": 1500,
      "currency": "BYN",
      "description": "Тренировка 30.05.2026 19:00",
      "tracking_id": "payment_42"
    },
    "settings": {
      "success_url": "https://volleytime.by/payment/success",
      "fail_url": "https://volleytime.by/payment/fail",
      "notification_url": "https://volleytime.by/webhooks/bepaid",
      "language": "ru",
      "customer_fields": {
        "visible": ["first_name", "email"],
        "read_only": []
      }
    },
    "payment_method": {
      "types": ["credit_card", "erip"]
    },
    "customer": {
      "first_name": "Иван",
      "last_name": "Петров",
      "email": "user@example.com"
    }
  }
}
```

### Ответ

```json
{
  "checkout": {
    "token": "abc123...",
    "redirect_url": "https://checkout.bepaid.by/v2/checkout?token=abc123..."
  }
}
```

`redirect_url` отправляется пользователю — он переходит на bePaid hosted page.

---

## Webhook

### Endpoint у нас

```
POST https://volleytime.by/webhooks/bepaid
```

### Что приходит

```json
{
  "transaction": {
    "uid": "12345-67890-abc",
    "status": "successful",
    "amount": 1500,
    "currency": "BYN",
    "tracking_id": "payment_42",
    "type": "payment",
    "payment_method_type": "credit_card",
    "created_at": "2026-05-30T10:30:00Z"
  }
}
```

### Заголовки

```
Content-Signature: base64(rsa_sha1_signature)
```

### Что делаем

1. Проверяем подпись через RSA public key (hard fail при ошибке → 403)
2. Парсим payload, извлекаем `bepaid_uid`, `tracking_id`, `status`
3. Идемпотентность: ищем Payment по `tracking_id`, проверяем `bepaid_uid`
4. Если уже processed — отвечаем 200 без побочных эффектов
5. Иначе:
   - `status: successful` → `PaymentService.confirm(payment.id)`
   - `status: failed` → `PaymentService.fail(payment.id)`
6. Отвечаем 200 (всегда, кроме invalid signature)

---

## Idempotency

Webhook может прийти **несколько раз** (bePaid ретраит при сетевых ошибках). Защита:

- Уникальный индекс на `Payment.bepaid_uid`
- При первом успешном webhook сохраняем uid
- При повторном — детектируем по uid и не делаем побочных эффектов

```typescript
// Псевдокод
const payment = await db.query.payments.findByTrackingId(tracking_id)
if (payment.bepaid_uid === webhook.transaction.uid && payment.status === 'succeeded') {
  return reply(200) // idempotent
}
```

---

## RSA подпись

bePaid подписывает webhook через RSA-SHA1. Мы верифицируем через **public key**.

```typescript
import { createVerify, createPublicKey } from 'node:crypto'

function verifySignature(body: Buffer, signature: string, publicKeyPem: string): boolean {
  const verifier = createVerify('RSA-SHA1')
  verifier.update(body)
  const signatureBuf = Buffer.from(signature, 'base64')
  return verifier.verify(publicKeyPem, signatureBuf)
}
```

**Без public key сервер НЕ должен стартовать** (hard fail).

---

## ЕРИП

ЕРИП — единая расчётная система Беларуси. Игрок оплачивает через свой банк-клиент.

В payload: `"payment_method": { "types": ["erip"] }`.

UX:

- bePaid hosted page показывает **код услуги** и инструкцию
- Игрок открывает банк-клиент → Платежи → ЕРИП → находит код → оплачивает
- Webhook приходит, как для карты

Опционально (Phase 12+): отправить QR-код игроку в Telegram для быстрой оплаты с мобильного банк-клиента.

---

## Refund

При отмене события админом — refund через bePaid API:

```
POST https://api.bepaid.by/transactions/{parent_uid}/refunds
Authorization: Basic base64(shop_id:secret_key)

{
  "request": {
    "amount": 1500,
    "reason": "Training cancelled by organizer"
  }
}
```

При успехе — `Payment.status = refunded`, `LedgerEntry(expense, category=refund)`.

---

## Безопасность

### Что НЕ должно попасть в логи

- ❌ `Authorization` заголовок
- ❌ Тело webhook payload (содержит PAN при некоторых типах)
- ❌ `Secret Key`
- ❌ Customer email (PII)

### Что МОЖНО логировать

- ✅ `bepaid_uid`
- ✅ `tracking_id`
- ✅ `status`
- ✅ `amount` (если решим)

### Хранение Secret Key

- В env-переменных
- Никогда в коде
- Не комитим .env в Git

### Public key

- В файле `/secrets/bepaid_public_key.pem`
- Не в Git (либо в Git с пометкой «only public!»)

---

## Multi-merchant (Phase 13)

Phase 13 превращает интеграцию в add-on:

```typescript
// Псевдокод
class BePaidClient {
  constructor(
    private shopId: string,
    private secretKey: string,
    private publicKey: string,
    private testMode: boolean
  ) {}

  // ...
}

// При входящем webhook — определяем merchant по tracking_id
const payment = await db.query.payments.findByTrackingId(tracking_id)
const org = await db.query.organizations.findById(payment.organization_id)
const merchantCreds = decryptCredentials(org.bepaid_credentials_encrypted)
const client = new BePaidClient(merchantCreds.shop_id, ...)
```

### Encryption

Credentials в БД — зашифрованы AES-256-GCM с key в env.

---

## Тестирование

### Unit tests

- Проверка подписи (valid, invalid, missing)
- Парсер webhook payload
- Идемпотентность по uid
- Amount mismatch (защита от подмены)
- Полный цикл с mock BePaidClient

### Integration в test mode

- В Phase 12 — sandbox bePaid + Playwright e2e
- В Phase 13 — отдельный test merchant + scenarios

---

## Альтернативы для РФ-организаторов

Phase 13 опционально:

- **ЮKassa** (Сбер) — для РФ-резидентов
- **Тинькофф Эквайринг**
- **CloudPayments**

Архитектура modular — добавление нового provider'а через interface `PaymentProvider`.

---

## Стоимость

bePaid:

- Подключение: бесплатно
- Комиссия: 2-3% от транзакции (зависит от тарифа)
- ЕРИП: иногда дороже карт (~3-4%)

Эта комиссия — **не платформы**. Организатор сам её несёт (при модели Phase 13 — деньги идут на его счёт).

---

## Чек-лист подключения (Phase 12)

- [ ] Юридическое лицо или ИП оформлены
- [ ] Анкета мерчанта подана в bePaid
- [ ] Договор подписан
- [ ] Получены Shop ID, Secret Key, Public Key
- [ ] Доступ к личному кабинету bePaid
- [ ] Тестовый shop_id для dev
- [ ] HTTPS-домен с валидным сертификатом
- [ ] Notification URL указан в кабинете bePaid
- [ ] Реализован BePaidClient
- [ ] Реализован webhook handler с RSA check
- [ ] Реализована идемпотентность
- [ ] Реализован refund flow
- [ ] Тесты проходят
- [ ] Сделана 1 тестовая оплата в sandbox
- [ ] Сделана 1 реальная оплата на минимальную сумму
- [ ] Логи прошёл review на PCI-чувствительные данные

---

## Ссылки

- [bePaid API docs](https://docs.bepaid.by) (внешний)
- [../phases/12-online-payments-own-org.md](../phases/12-online-payments-own-org.md)
- [../phases/13-online-payments-addon.md](../phases/13-online-payments-addon.md)
- [TAXES.md](./TAXES.md)
