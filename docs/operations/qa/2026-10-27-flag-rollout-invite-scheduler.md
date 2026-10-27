# Включение флагов: режим по приглашению и планировщик, 2026-10-27

> Задачи [20.7.1](../../tasks/20-7-1-release-v0-2-0-qa.md) (Follow-up, пп. 7 и 9). Evidence наблюдений координатора (CI, Deploy, проверки на VPS); подтверждения владельца — его сообщения в чате координатору. Предыдущий шаг: [баланс и несколько мест](2026-10-27-flag-rollout-balance-multiseat.md).

## 1. `EVENT_INVITE_MODE_ENABLED`

2026-10-27, с подтверждением владельца в чате.

| Шаг                | Результат                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Предпроверка       | `SELECT count(*) FROM organizations WHERE default_join_mode = 'invite'` вернул 0                             |
| Продвижение `prod` | fast-forward `e56fee2` → `087fc1492c6f395082e8f45e54f2949d34245757` (`087fc14`)                              |
| Deploy             | [40559685328](https://github.com/trafficolog/volleytime/actions/runs/40559685328) success, фаза smoke-passed |
| Рантайм            | `docker exec vt_web printenv`: `EVENT_INVITE_MODE_ENABLED=true`                                              |
| Health             | `/api/health` ok, `release=087fc14`                                                                          |

## 2. `SCHEDULER_ENABLED`

2026-10-27, с подтверждением владельца в чате.

| Шаг                | Результат                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Продвижение `prod` | fast-forward `087fc14` → `b4186e3fc57da525d7a49df6659f0b723f0a3a79` (`b4186e3`); диапазон только документы, main CI четыре job success |
| Deploy             | [40562856130](https://github.com/trafficolog/volleytime/actions/runs/40562856130) success, фаза smoke-passed                           |
| Рантайм            | `printenv` в `vt_web`: `EVENT_INVITE_MODE_ENABLED=true` и `SCHEDULER_ENABLED=true`                                                     |
| Планировщик        | в логе `vt_web` строка `[scheduler] started`; ошибок планировщика в первые 15 минут нет                                                |
| Интервал           | `SCHEDULER_INTERVAL_MS` не задан, действует значение по умолчанию 15000 мс                                                             |
| Health             | `/api/health` ok, `release=b4186e3`                                                                                                    |

## 3. Состояние флагов

Включены: `EVENT_SPLIT_PRICING_ENABLED`, `EVENT_BALANCE_ENFORCED`, `EVENT_MULTI_SEAT_ENABLED`, `EVENT_INVITE_MODE_ENABLED`, `SCHEDULER_ENABLED`. Выключен: `TELEGRAM_LOGIN_WIDGET_ENABLED` (виджет входа; включается по решению владельца).

## 4. Откат

Откат приложения на `b056806` (v0.1.7) при данных режима по приглашению и планировщика отказывает; восстановление только вперёд (roll-forward), решение 2026-10-26 принято ранее. Пин `b056806` в `.deploy/retain-pins` будет снят отдельным шагом, когда откат на него уже отказывает.

## Не проверено и открыто

- Работа планировщика на живых событиях (автозакрытие записи, напоминания, предложения из листа ожидания) пока не наблюдалась; наблюдать `[scheduler]` в логах и `scheduled_jobs` со статусом `failed` (раздел deploy runbook).
- Режим по приглашению на живых событиях и ссылках не проверялся на устройствах.
- `TELEGRAM_LOGIN_WIDGET_ENABLED` выключен.
- Проверка отката приложения и проверки на устройствах — открытые пункты Follow-up карточки 20.7.1, этим evidence не закрываются.
