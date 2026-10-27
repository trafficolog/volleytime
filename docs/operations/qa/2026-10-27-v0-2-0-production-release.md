# Выпуск v0.2.0 в production, 2026-10-27

> Задача [20.7.1](../../tasks/20-7-1-release-v0-2-0-qa.md), п. 4. Evidence наблюдений координатора (CI, Promote, Deploy, проверки на VPS только на чтение); приёмка владельцем — его сообщением в чате координатору.

Релиз v0.2.0 = `6143f4256b9da555a90249aeb7de2ccac022521e` (`6143f42`). Аннотированный тег `v0.2.0` опубликован на этот SHA 2026-10-27.

| Шаг                | Результат                                                                                                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR релиза          | [#183](https://github.com/trafficolog/volleytime/pull/183) (проводка флагов и quiescent-guard), [#184](https://github.com/trafficolog/volleytime/pull/184) (QA релиза, чеклист владельца), [#185](https://github.com/trafficolog/volleytime/pull/185) (проводка `TELEGRAM_LOGIN_WIDGET_ENABLED`, после релизного SHA) |
| main CI            | [40349167990](https://github.com/trafficolog/volleytime/actions/runs/40349167990) на `6143f42`: все четыре job success, включая Runner image build-export-import                                                                                                                                                      |
| Promote            | [40355567669](https://github.com/trafficolog/volleytime/actions/runs/40355567669) отказал до любого push: диапазон `b056806..6143f42` меняет `.github/workflows`, а секрет `PROMOTE_TOKEN` не задан                                                                                                                   |
| Продвижение `prod` | по runbook — ручной `git push origin 6143f42:prod` 2026-10-26 после проверки ancestry; владелец подтвердил это в чате                                                                                                                                                                                                 |
| Deploy             | [40355995553](https://github.com/trafficolog/volleytime/actions/runs/40355995553) (image-bundle) success; фазы verified → loaded → backed-up → migrated → activated → smoke-passed                                                                                                                                    |
| Миграции           | применены 0021–0031; в `drizzle.__drizzle_migrations` было 21 строка, стало 32                                                                                                                                                                                                                                        |
| Smoke              | внешний синтетический smoke OK, cleanup выполнен                                                                                                                                                                                                                                                                      |

## Проверки на VPS после выкладки (2026-10-27, только чтение)

| Проверка         | Результат                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| health           | `release=6143f42`, `status ok`                                                                                                                                                      |
| phase            | `smoke-passed 6143f42`                                                                                                                                                              |
| Образы web и bot | метки `event-split-pricing`, `multi-seat`, `invite-mode`, `scheduler` = `"1"`; `revision` = `6143f42`                                                                               |
| `.env`           | `EVENT_SPLIT_PRICING_ENABLED=true`; `EVENT_BALANCE_ENFORCED`, `EVENT_MULTI_SEAT_ENABLED`, `EVENT_INVITE_MODE_ENABLED`, `SCHEDULER_ENABLED` = `false`; `SCHEDULER_INTERVAL_MS=15000` |
| Guard отката     | строки для мест, приглашений и планировщика все `f`: откат приложения на `b056806` сейчас разрешён                                                                                  |
| Планировщик      | строк `[scheduler]` в логе web нет (флаг выключен, цикл не стартует)                                                                                                                |
| Root admin       | `SELECT email FROM users WHERE is_root_admin AND is_active` — 0 строк: активных root admin в production нет                                                                         |

## Приёмка владельца

2026-10-27, в чате координатору: релиз принят. Слова владельца: «есть небольшие огрехи, но исправим их позже». Конкретные дефекты ещё не перечислены; они придут отдельными задачами. Приёмка не подтверждает проверки на устройствах, о которых владелец не отчитался (список — в разделе «Follow-up (после выпуска)» карточки 20.7.1).

## Состояние флагов

Все новые флаги выключены, кроме ранее включённого `EVENT_SPLIT_PRICING_ENABLED`. Их включают по одному после выпуска (раздел 6 [чеклиста владельца](2026-10-26-20-7-1-owner-checklist.md)). `TELEGRAM_LOGIN_WIDGET_ENABLED` проведён в `main` ([#185](https://github.com/trafficolog/volleytime/pull/185)) и попадёт в production со следующим релизным коммитом; на `6143f42` его нет.

## Не проверено и открыто

- Секрет `PROMOTE_TOKEN` не задан: Promote с изменением workflows не работает, продвижение идёт вручную по runbook.
- Реальный откат приложения на `b056806` не исполнялся (проверено только состояние guard).
- Открытый пункт владельца: нужен активный root admin; без него нельзя выполнить `pnpm db:event-balance reconcile --operator <root email>` и включить `EVENT_BALANCE_ENFORCED`.
- Проверки на устройствах (п. 2, 11, 13 карточки 20.7.1), о которых владелец не сообщал отдельно, этим evidence не подтверждаются.
