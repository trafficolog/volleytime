---
id: '27.3'
phase: '27'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10. Релиз назначает владелец.'
estimated_hours: '21-44'
depends_on: []
---

# Epic 27.3: Вход и сессии

**Цель.** Вход через email-код и Telegram устойчив к перебору, повтору и подделке запросов; пользователь управляет своими сессиями.

## Контекст

Фаза [27](../phases/27-audit-hardening.md). Источник — [аудит 2026-11-10](../operations/reviews/2026-11-10-project-audit.md), раздел 2.3 (AUTH).

## Definition of Done

- Настройки better-auth (origins, cookie, лимиты попыток) заданы явно и покрыты тестами.
- Мутирующие запросы с чужого origin отклоняются.
- Повтор initData и перебор email-кода не дают входа.
- Сессии отзываются выходом со всех устройств и блокировкой.

## Задачи

| ID                                                 | Задача                                                                          | Замечание | Приор. | Сложн. | Реализация          | Ревью             |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | --------- | ------ | ------ | ------------------- | ----------------- |
| [27.3.1](../tasks/27-3-1-auth-origin-csrf.md)      | Явные trustedOrigins, атрибуты cookie и проверка Origin для мутирующих запросов | AUTH-01   | P1     | XL     | `claude-opus-5-5`   | `claude-opus-5-5` |
| [27.3.2](../tasks/27-3-2-otp-attempts.md)          | Предел попыток email-кода и отправок на адрес                                   | AUTH-02   | P2     | L      | `claude-sonnet-5-5` | `claude-opus-5-5` |
| [27.3.3](../tasks/27-3-3-initdata-replay.md)       | Защита от повторного использования initData                                     | AUTH-03   | P2     | XL     | `claude-opus-5-5`   | `claude-opus-5-5` |
| [27.3.4](../tasks/27-3-4-telegram-link-unlink.md)  | Привязка Telegram: проверки в транзакции и отвязка                              | AUTH-04   | P2     | L      | `claude-sonnet-5-5` | `claude-opus-5-5` |
| [27.3.5](../tasks/27-3-5-session-management.md)    | Выход со всех устройств и отзыв сессий при блокировке                           | AUTH-05   | P2     | L      | `claude-sonnet-5-5` | `claude-opus-5-5` |
| [27.3.6](../tasks/27-3-6-login-widget-decision.md) | Login Widget: включить с проверкой или удалить                                  | AUTH-06   | P3     | M      | `claude-sonnet-5-5` | `claude-opus-5-5` |

## Не делать

- ❌ Не менять способы входа и экраны входа сверх карточек
- ❌ Не ослаблять проверку подписи Telegram
