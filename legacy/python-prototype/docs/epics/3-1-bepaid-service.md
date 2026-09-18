---
id: "3.1"
phase: 3
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: "Базовый строительный блок Phase 3. Без этого эпика остальные не запустятся."
---

# Epic 3.1: Сервис bePaid

**Цель.** HTTP-клиент к bePaid API: создание checkout-токена для оплаты, refund при отмене, поддержка ЕРИП. Все исходящие запросы к bePaid идут через этот сервис.

## Контекст

После Phase 2 у нас есть `PaymentService`, который умеет помечать платёж `succeeded` через ручное подтверждение админом. Phase 3 заменяет это на webhook от bePaid. Но прежде чем webhook что-то нам пришлёт, нам нужно **создать платёж в bePaid** через их API — это и есть задача 3.1.

## Definition of Done

- Класс `BePaidClient` с методами: `create_checkout`, `refund`, `get_transaction`
- HTTP Basic Auth работает (Shop ID + Secret Key)
- Создание checkout возвращает `payment_url`, по которому пользователь идёт на hosted page
- Тестовый режим (`test: true`) включается из `settings.bepaid_test_mode`
- ЕРИП работает наравне с картой (один payment_method, выбор пользователем на странице)
- Refund возвращает деньги на исходную карту
- Сетевые ошибки (timeout, 5xx) ретраятся с экспоненциальным backoff
- В логах никогда не появляется Secret Key и полный response с PAN

## Задачи

| ID | Задача | Статус |
|----|--------|--------|
| [3.1.1](../tasks/3-1-1-bepaid-client.md) | BePaidClient: HTTP Basic Auth + checkout | todo |
| [3.1.2](../tasks/3-1-2-bepaid-refund.md) | Refund API | todo |
| [3.1.3](../tasks/3-1-3-bepaid-erip.md) | Поддержка ЕРИП | todo |

## Не делать

- **Не сохраняем данные карт.** Никогда. Только `bepaid_uid` и `bepaid_status`.
- **Не делаем серверную интеграцию с 3DS.** Используем hosted page — bePaid сам всё разруливает.
- **Не пишем парсер ответа в этом эпике.** Возвращаем raw dict, парсинг — в `PaymentService`.
- **Не делаем circuit breaker.** Простой retry достаточно для нашей нагрузки.
