# Релиз-план Volley Time

> Привязка фаз/эпиков/задач к релизам. Определяет точку MVP и последующие этапы.
> **Номер фазы = ID (не порядок).** Релизы группируют фазы по бизнес-ценности.
> Для ведения в GitHub: каждый релиз = **milestone**, каждая задача = **issue** (см. [GITHUB_SETUP.md](./GITHUB_SETUP.md)).

## Обзор релизов

| Релиз                   | Версия   | Цель                                             | Фазы        |  Задач | Оценка          |
| ----------------------- | -------- | ------------------------------------------------ | ----------- | -----: | --------------- |
| **R0 — MVP**            | `v0.1.0` | **Бот для ОДНОЙ компании: записи + учёт**        | 3,4,5,6,8,9 |    139 | ~205-285 ч      |
| R1 — Automation         | `v0.2.0` | Напоминания, авто-переходы, надёжные уведомления | 15          |     16 | ~20-30 ч        |
| R2 — Multi-Company Beta | `v0.3.0` | Открытие для 2-5 внешних организаторов (гейт)    | 10          |     11 | ~10-15 ч + поле |
| R3 — Monetization       | `v1.0.0` | Event credits — платная модель                   | 7           |     15 | ~20-30 ч        |
| R4 — Payments Online    | `v1.1.0` | Онлайн-оплата (bePaid): credits + игроки         | 12,13       | скелет | ~55-75 ч        |
| R5 — Contributions      | `v1.2.0` | Добровольные сборы                               | 11          | скелет | ~25-35 ч        |
| R6 — Reports            | `v1.3.0` | Отчёты, экспорт, аналитика                       | 14          | скелет | ~25-35 ч        |
| R7 — Competitions       | `v2.0.0` | Матчи + турниры (порт Level Volley)              | 16,17       | скелет | ~110-150 ч      |
| R8 — CRM Pro            | `v2.1.0` | Продвинутый CRM                                  | 18          | скелет | ~80-120 ч       |

**Расписаны детально (готовы к разработке):** R0-R3 (9 фаз, 181 задача). R4+ — phase-card скелеты, детализируются по факту беты.

---

## R0 — MVP: «Бот для одной компании» `v0.1.0`

> **ТВОЙ ПРИОРИТЕТ.** Полноценный Telegram-бот, которым одна компания (группа/клуб) ведёт записи на тренировки и учёт денег. Мультитенантность построена (Phase 4), но используется одна организация.

### Цель релиза

Один организатор ведёт свою группу **целиком через Telegram**, без Excel и сторонних инструментов:

- создаёт события (тренировки/игры), игроки записываются
- работают абонементы (списание занятий) и разовая оплата
- организатор подтверждает оплаты, ведёт кассу (доходы/расходы, баланс)
- отмечает посещаемость
- все получают уведомления (запись, подтверждение, отмена, waitlist)
- работает 24/7 на production

### Definition of Done (MVP)

- ✅ Организатор создаёт организацию, приглашает игроков ссылкой
- ✅ Создание событий (вместимость, цена, дедлайн отмены, площадка)
- ✅ Игрок записывается: с абонемента / разовая оплата / лист ожидания
- ✅ Абонементы: покупка, списание занятия при записи, возврат при отмене
- ✅ Оплаты: организатор подтверждает наличные/перевод → касса
- ✅ Касса: баланс, история, расходы (аренда, инвентарь)
- ✅ Посещаемость (был/не был)
- ✅ Отмена события → возврат занятий/денег всем участникам
- ✅ Telegram: авто-логин (initData), MainButton, уведомления
- ✅ Развёрнуто на VPS (HTTPS, webhook, бэкапы, мониторинг)
- ✅ Критерий: неделя реальных тренировок только через бота

### Состав по фазам

| Фаза                       | Эпики    | Роль в MVP                                                |
| -------------------------- | -------- | --------------------------------------------------------- |
| **3 Foundation**           | 3.1-3.8  | Монорепо, БД, auth, Docker, CI — фундамент                |
| **4 Organizations**        | 4.1-4.8  | Организация, участники, приглашения, роли, tenant         |
| **5 Events/Bookings/Subs** | 5.1-5.12 | Ядро: события, записи, абонементы, waitlist, посещаемость |
| **6 Payments/Ledger**      | 6.1-6.7  | Учёт: подтверждение оплат, касса, mass refund             |
| **8 Telegram Bot+MiniApp** | 8.1-8.7  | Telegram-интерфейс: auth, WebApp, бот, уведомления        |
| **9 Production Deploy**    | 9.1-9.8  | VPS, HTTPS, webhook, бэкапы, мониторинг, CI/CD            |

### Порядок реализации внутри MVP

```
3 (Foundation)
  → 4 (Organizations)
    → 5 (Events/Bookings/Subscriptions)
      → 6 (Payments/Ledger)
        → 8 (Telegram Bot + Mini App)   ← оживляет всё вышеперечисленное
          → 9 (Production Deploy)         ← запуск 24/7
```

### Возможные сокращения для более раннего запуска (опционально)

Если нужно выпустить ещё быстрее, эти эпики можно отложить в fast-follow (v0.1.x) без потери базового процесса:

- **4.6 Audit log** — журнал действий (полезно, но не блокирует работу)
- **5.4/5.5/5.11 Subscriptions** — если компания работает ТОЛЬКО по разовой оплате (без абонементов), весь блок абонементов можно отложить. НО: если абонементы нужны (как в Level Volley) — оставить, они глубоко интегрированы
- **6.6 UI касса** — если учёт достаточно вести через подтверждение оплат без отдельного экрана кассы на старте

> Рекомендация: не дробить фазы без крайней необходимости — чище выпустить MVP целиком по фазам 3-6+8+9. Сокращения — только если сроки критичны.

### НЕ входит в MVP (сознательно отложено)

- ❌ Монетизация (event credits) — R3: ты не платишь сам себе за свою же компанию
- ❌ Мультикомпанийная бета (allowlist, super-admin) — R2: одна компания не требует
- ❌ Напоминания/автоматизация — R1: на старте организатор ведёт вручную
- ❌ Онлайн-оплаты, сборы, отчёты, турниры, CRM — R4+

---

## R0.1 — MVP Hardening (исправления по ревью) `v0.1.1`

> Ревью реализации `main @ 3882bc1 (v0.1.0)` от 2026-09-16 нашло 21 P0: MVP нельзя запускать для реальной группы (вход, webhook, уведомления, Mini App, неоплаченные абонементы/тренировки). Все находки оформлены задачами — **по одному фикс-эпику на фазу**. Ревью: [`docs/operations/reviews/2026-09-16-v0.1.0-review.md`](./operations/reviews/2026-09-16-v0.1.0-review.md).

| Фаза | Фикс-эпик                            | Содержание                                                                                  |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| 3    | [3.9](./epics/3-9-review-fixes.md)   | env/runtimeConfig, схема better-auth, единая сессия, quality gates web, дизайн-токены       |
| 4    | [4.9](./epics/4-9-review-fixes.md)   | эскалация ролей, инвайты, audit, pending, approve/reject/unblock, UI инвайтов               |
| 5    | [5.13](./epics/5-13-review-fixes.md) | org-scoping броней/абонементов, промоушен, методы оплаты, CHECK/FK, UI событий и админки    |
| 6    | [6.8](./epics/6-8-review-fixes.md)   | атомарные денежные переходы, оплата абонементов, отклонение → waitlist, UI платежей и кассы |
| 8    | [8.8](./epics/8-8-review-fixes.md)   | Telegram SDK, старт-роутер, тема, уведомления, навигация Mini App                           |
| 9    | [9.9](./epics/9-9-review-fixes.md)   | migrate-стадия, webhook-маршрут, smoke с авторизацией, Sentry, CI/CD, бэкапы                |

**Порядок:** 3.9 → 4.9 → 5.13 → 6.8 → 8.8 → 9.9 (внутри — по `depends_on`). Коммиты: `Release: v0.1.1`, ветки `fix/<task-id>-<slug>`.

**Статус на 2026-09-17:** все 86 задач закрыты и смёржены в `main`; 370 тестов зелёные, `pnpm lint`/`pnpm typecheck` чистые, прод-сборка web и бота проверены локально (`scripts/verify-build.sh`, `scripts/smoke.mjs`). Не сделано вне репозитория: прогон чеклиста ручного QA в Telegram (8.8.11) и деплой на VPS.

---

## R0.2 — Повторное ревью `v0.1.2`

> Повторное ревью 2026-09-18 подтвердило: все 21 P0 закрыты вживую, 370 тестов зелёные. Найдено 9 новых пунктов (4 P1, 5 P2) — закрываются эпиками **3.10, 5.14, 6.9, 8.9, 9.10**. Отчёт: [`docs/operations/reviews/2026-09-18-v0.1.1-rereview.md`](./operations/reviews/2026-09-18-v0.1.1-rereview.md).

| Фаза | Фикс-эпик                             | Содержание                                                                 |
| ---- | ------------------------------------- | -------------------------------------------------------------------------- |
| 3    | [3.10](./epics/3-10-review2-fixes.md) | снимок состояния, токен сессии в ответе, русские тексты ошибок             |
| 5    | [5.14](./epics/5-14-review2-fixes.md) | кнопка «Записаться» над таб-баром                                          |
| 6    | [6.9](./epics/6-9-review2-fixes.md)   | категории ручного дохода                                                   |
| 8    | [8.9](./epics/8-9-review2-fixes.md)   | уведомление о брони, ждущей оплаты                                         |
| 9    | [9.10](./epics/9-10-review2-fixes.md) | откат деплоя, лимитер за прокси, точный матчер webhook, smoke-пользователь |

Коммиты: `Release: v0.1.2`, ветки `fix/<task-id>-<slug>`.

---

## R0.3 — Release Readiness `v0.1.3`

> Patch без расширения продуктового scope. Цель — синхронизировать release-документацию, опубликовать фактический MVP-код в канонический GitHub и получить свежий воспроизводимый CI gate перед первым production deploy.

Входит:

- epic **9.11** / task **9.11.1** — status drift, root docs, GitHub publication, release-readiness review;
- унификация release runtime на Node.js 22 (`.nvmrc`, package engines, Docker, CI);
- CI: format, lint, typecheck, unit/integration tests, build.

На момент публикации `v0.1.3` не закрывал:

- ручной QA в настоящем Telegram;
- первый VPS deploy и production smoke;
- реальный backup/restore и внешний monitoring;
- неделю эксплуатации на реальной группе из R0 Definition of Done.

**Статус 2026-09-18:** canonical R0 scope — **ровно 139 исходных задач** из фаз 3.1-3.8, 4.1-4.8, 5.1-5.12, 6.1-6.7, 8.1-8.7 и 9.1-9.8. Текущий R0 snapshot после Task 4.7.5: **123 done / 16 in_progress**. Дополнительные 98 hardening/review/release-readiness cards не входят в знаменатель 139 и используются только как evidence исправлений.

На снимке `v0.1.3` после PR #4 и PR #5 известных repository implementation gaps в R0 уже не оставалось: 9.8.2 имела green CI для secrets materialization/migrate ordering; 9.8.3 — для тогдашней GHCR-default схемы, manual build-on-VPS fallback и rollback runbook. Обе карточки оставались `in_progress`, потому что их live acceptance ещё требовала GitHub Secrets/VPS/deploy/rollback; последующий результат зафиксирован ниже в `v0.1.4`.

`v0.1.2` остаётся неизменным историческим тегом. `v0.1.3` создаётся только после успешного repository release-gate.

---

## R0.4 — Production Automation `v0.1.4`

> Patch без расширения продуктового scope. `v0.1.3` зафиксирован как проверенный manual-production baseline `91f6bff`; `v0.1.4` автоматизирует безопасное продвижение `main → prod → VPS`.

Входит:

- отдельный restricted SSH credential для GitHub Actions и fail-closed production Secrets;
- prod-only workflow с source gate;
- доставка exact SHA через проверяемый Git bundle без исходящего GitHub/GHCR-доступа с VPS;
- release-local PostgreSQL backup до checkout advancement и migrations;
- SHA-tagged local images и одинаковая release identity в Git, web и bot health;
- explicit rollback на immutable ancestor с совместимостью legacy Compose;
- production polling fallback при рабочем Telegram IPv6 egress и недоступном IPv4 webhook ingress.

Live evidence 2026-09-21:

- tested candidate `c8648c25ce2e1955806cb051af5365089945d2ca` прошёл workflow `35513044804`;
- controlled rollback на `v0.1.3` (`91f6bffbd005876f94ffd1c31cebb4bcd891a752`) сохранил healthy runtime и polling без отката БД;
- redeploy workflow `35566144557` вернул exact candidate SHA и сохранил v0.1.3 как rollback manifest;
- последний audited release backup прошёл gzip validation; отдельный production dump ранее восстановлен в isolated PostgreSQL 16 с 15 public tables.
- финальный workflow `35569731828` продвинул docs-inclusive SHA `16c2fe422db94bc97c085201a6cf9fcc919b7b72`; `main`, `prod`, VPS, web и bot совпали по полному SHA;
- annotated tag и public GitHub Release `v0.1.4` опубликованы на финальном production SHA; post-deploy audit подтвердил healthy runtime, polling и валидный release backup.

Текущий canonical R0 snapshot после production notification E2E: **132 done / 7 in_progress из 139 задач**. Открыты manual Telegram/BotFather acceptance, webhook ingress, Sentry/UptimeRobot, S3 upload/restore и недельный pilot gate.

Immutable tag `v0.1.4` является источником истины для финального docs-inclusive production SHA `16c2fe422db94bc97c085201a6cf9fcc919b7b72`; тег опубликован после успешного продвижения `main` в `prod` и повторного exact-SHA smoke.

---

## R0.5 — Telegram Bot Identity Guard `v0.1.5`

> Patch без расширения продуктового scope. Исправляет production drift, при котором invite URL указывал на legacy-бота, а Mini App и уведомления работали через token актуального бота.

Входит:

- отдельная диагностика Task 9.9.15 с live-сверкой web/bot config и Telegram `getMe`;
- secret-safe deployment verifier соответствия `TELEGRAM_BOT_USERNAME` владельцу `TELEGRAM_BOT_TOKEN`;
- fail-closed остановка до рендера/upload production env при mismatch, сетевой ошибке или невалидном ответе;
- production Secret и runtime config исправлены на `volleytimeby_bot` без изменения invite tokens;
- Task 9.9.16 проведена через RED → GREEN, полный repository gate, CI, backup/deploy/smoke и независимый VPS audit.

Live evidence 2026-09-21:

- PR #34 merged as `67bbfe89acaac04992b8128d45cb1b40f8acc75c`; production workflow `35650271644` завершился успешно;
- реальный GitHub Actions guard принял исправленную пару username/token до работы с VPS;
- Git HEAD, public web health и bot health совпали на exact SHA `67bbfe89acaac04992b8128d45cb1b40f8acc75c`;
- web server/public config, bot config и Telegram `getMe` совпали на `volleytimeby_bot`;
- sample invite URL использует `https://t.me/volleytimeby_bot?start=org_…`;
- web, bot и PostgreSQL healthy, restart count `0`, release backup создан;
- annotated tag и public GitHub Release `v0.1.5` опубликованы на проверенном production SHA.

Canonical R0 snapshot не изменился: **132 done / 7 in_progress из 139 задач**. Открыты только прежние manual Telegram/BotFather acceptance, webhook ingress, Sentry/UptimeRobot, S3 upload/restore и недельный pilot gate.

---

## R0.6 — MVP UI refresh `v0.1.6` (кандидат; локальная QA принята)

2026-09-29 **локальный predeploy gate принят**: [PR #68](https://github.com/trafficolog/volleytime/pull/68), `main=32d7c4f`, exact-head [CI 36552036320](https://github.com/trafficolog/volleytime/actions/runs/36552036320) success, tree merge/head совпадает. 8.10.3 и все MVP implementation dependencies done; доступны продвижение проверенного main после его CI, reviewed fast-forward prod и Actions deploy по runbook. До реального Telegram/pilot после выкладки кандидат **не** считается окончательно принятым релизом. Старые ожидания ниже сохранены как история.

2026-09-29 **8.10.3 локальный release gate**: объединённый runtime `1a063e5` (равен main `99cae3a`) прошёл пять gates 125/731, exact-SHA local synthetic smoke и independent re-review без Critical/Important. Полный [F/P/T closure-map](./operations/qa/2026-09-28-r06-integrated-matrix.md) сохраняет scope и ограничения visual QA. PR/exact-head CI QA-ветки ещё ожидаются; это не production deploy и не окончательная Telegram/pilot acceptance.

2026-09-29 **3.11.10 принята в main** через [PR #66](https://github.com/trafficolog/volleytime/pull/66), merge `99cae3a`: RED→GREEN для OTP countdown `60 → 1:00`, затем `59 → 0:59`; пауза и API не менялись. Native Chrome 200% подтвердил исправление, пять gates (125 файлов/731 тест), scoped review без блокеров. [CI PR 36542875997](https://github.com/trafficolog/volleytime/actions/runs/36542875997) и [main CI 36543085212](https://github.com/trafficolog/volleytime/actions/runs/36543085212) success, дерево merge совпадает с проверенным head. Итоговая интегрированная QA 8.10.3 ещё открыта; `prod`/VPS не менялись.

2026-09-29 **8.10.6 принята в main** через [PR #64](https://github.com/trafficolog/volleytime/pull/64), merge `c473de1`: Vue RED→GREEN включая review-fix failed revoke, Chrome error/retry 45/45 и отказ отзыва 4/4, пять gates (125 файлов/727 тестов), независимое re-review без блокеров, [CI PR 36538108493](https://github.com/trafficolog/volleytime/actions/runs/36538108493) и [main CI 36538310519](https://github.com/trafficolog/volleytime/actions/runs/36538310519) успешно. Дерево merge равно проверенному head. [Актуальный QA closure-map 8.10.3](./operations/qa/2026-09-28-r06-integrated-matrix.md) закрывает доступные локальные O по F/P evidence, но его итоговые gates/review/CI ещё предстоят. `prod`/VPS остаются v0.1.5; настоящий Telegram-host QA проводится после контролируемой выкладки полного кандидата, до окончательной приёмки релиза.

Исторический RED-checkpoint 2026-09-29: в ходе сквозного QA была выделена дополнительная [8.10.6](./tasks/8-10-6-miniapp-invite-load-retry.md): ошибка GET приглашений organizer Mini App показывала ложный empty без retry. Четыре Chrome RED на 320/390 light/dark привели к отдельной SDD-TDD задаче; её последующее принятие отражено выше. Этот checkpoint сам по себе не означал готовности deploy.

2026-09-29 **3.11.9** принята через [PR #61](https://github.com/trafficolog/volleytime/pull/61), merge `b4c9630`: существующие локальные Oswald/Golos глобально доступны на прямом auth/desktop entry. Browser RED → GREEN (семь весов/local 200/кириллица, без Google), пять gates (124 files / 722 tests), owner 103/103, auth 15/15, landing 5/5 и независимые task/whole-branch review прошли; [CI 36523981993](https://github.com/trafficolog/volleytime/actions/runs/36523981993) success на точном `67ef8c6`, полное дерево merge идентично head. [Отчёт](./operations/qa/2026-09-29-global-local-reference-fonts.md). Общая **8.10.3**, полный release gate и post-deploy Telegram-host acceptance остаются открыты; prod/VPS не менялись.

Дополнение 2026-09-26: [3.11.7 — соответствие лендинга исходному референсу](./tasks/3-11-7-landing-reference-fidelity.md) закрывает замечания к визуальному переносу 3.11.4. Входит в R0.6 до общего QA: точная палитра, исходные шрифты/композиция и локальная поставка шрифтов. Пользовательский выбор точных цветов не означает WCAG-приёмку исходного оранжевого; ограничение контраста фиксируется отдельно.

> Визуальное обновление существующего MVP по очищенному архиву `Volley Time v2.zip` от 2026-09-24. [Карта референсов и граница scope](./design/2026-09-23-reference-v2.md). Версия — кандидат после опубликованного `v0.1.5`; этот раздел не означает, что все задачи выполнены или релиз выпущен.

Порядок SDD-задач: **3.11.1** (токены) → **3.11.2** (компоненты); после 3.11.2 независимые **3.11.3** (авторизация) → **3.11.6** (исправление выхода после OTP), **3.11.4** (публичный MVP-лендинг) → **3.11.5** (доступность) → **3.11.7** (точность референса) и **5.13.21** (переключатель абонементов организации). Далее **8.10.1** (Mini App игрока), **8.10.2** (Mini App организатора) с review-fix **8.10.4/8.10.5**, **5.15.1** (desktop организатора) → **6.10.1** (desktop-оплаты/касса) → **8.10.3** (сквозной QA, включая лендинг). В ходе review 8.10.2 обнаружены серверные гонки **6.8.13** и **6.8.14**; их RED→GREEN и отдельные gates обязательны для R0.6. Независимые задачи могут идти параллельно только в отдельных ветках и с отдельными gates. Лендинг сохраняет композицию `0 Лендинг.html`, но не публикует credits-тарифы, цены и обещания функций вне MVP.

Релиз охватывает только функции R0/MVP. Root Admin, credits, сборы, отчёты, онлайн-оплата и автоматизация остаются backlog соответствующих будущих релизов. В `prod` попадает только собранный и проверенный кандидат после merge задач в `main`, визуального и функционального QA; одних repository tests недостаточно для заявления о Telegram/production acceptance.

Дополнительная review-fix задача **8.10.5** — перенос действий приглашения Mini App и цель отзыва 44×44. Локальный RED/GREEN (12 browser cases), пять gates, scoped review и CI пройдены 2026-09-28; [PR #53](https://github.com/trafficolog/volleytime/pull/53) принят в main как `16d7266`, CI `36427906815` прошёл на финальном SHA. Локальная интеграция в 8.10.2 прошла повторные пять gates, whole-branch review без замечаний и 40 browser cases; [отчёт и границы](./operations/qa/2026-09-28-organizer-miniapp-post-main.md). Общий 8.10.3 и выпуск R0.6 остаются открытыми.

Для пилота без пользователей (решение 2026-09-27) реальный Telegram-host QA проводится **на production после** контролируемой выкладки полного кандидата R0.6, а не на отдельном тестовом стенде. До выкладки обязательны завершение всех MVP-задач, review, доступный локальный визуальный/функциональный QA и CI. При выкладке — резервная копия БД перед миграциями по runbook; после неё — проверка точного SHA, health/runtime smoke и ручной Telegram QA на тестовых аккаунтах и организации. До успешной полевой проверки выпуск остаётся кандидатом, не окончательно принятым MVP.

2026-09-28 **8.10.2** и отдельно проверенный stacked fix **8.10.4** приняты в main через [PR #55](https://github.com/trafficolog/volleytime/pull/55), merge `2086ee4`, после локальных пяти gates, whole-branch review, 40 browser cases и [CI 36430967186](https://github.com/trafficolog/volleytime/actions/runs/36430967186) success на `ec6493d`. Это не общий release gate: Mini App игрока (PR #47), лендинг (PR #43), их совместная QA и **8.10.3** ещё требуют завершения. `prod` и VPS не менялись.

2026-09-28 **8.10.1** Mini App игрока принят в main через [PR #47](https://github.com/trafficolog/volleytime/pull/47), merge `f5a9d41` после пяти локальных gates, independent review без оставшихся замечаний, локальной browser/real-API QA и [CI 36452709192](https://github.com/trafficolog/volleytime/actions/runs/36452709192) success на `ae678dd`. Историческая строка выше о draft PR #47 относится к состоянию до merge. Лендинг PR #43, общий **8.10.3** и реальный Telegram-host QA полного кандидата ещё открыты; `prod`/VPS не менялись. Для лендинга native 200% zoom и настоящая фоновая вкладка stop/resume подтверждены пользователем; интеграция с main прошла локальные пять gates и Chrome QA. Minor resilience-находка оформлена отдельно как **3.11.8** (управляемый fallback ошибки сессии), до итогового R0.6 gate, без расширения функций MVP.

2026-09-28 **3.11.4** лендинг принят в main через [PR #43](https://github.com/trafficolog/volleytime/pull/43), merge `1fa662f`: пять локальных gates (123 files / 717 tests), Chrome QA и independent review без блокеров; [CI 36467608712](https://github.com/trafficolog/volleytime/actions/runs/36467608712) success на `e6bfaf3`, дерево merge идентично проверенному. Предыдущая строка о незавершённом PR #43 историческая. Отдельная **3.11.8** и общий **8.10.3** ещё открыты; release readiness и production этим merge не объявляются.

2026-09-28 **3.11.8** принята в main через [PR #59](https://github.com/trafficolog/volleytime/pull/59), merge `07fb8af`: mounted RED→GREEN, пять gates (124 files / 722 tests), Chrome 503 fallback/CTA/FAQ и landing regression, independent review без замечаний; [CI 36476869854](https://github.com/trafficolog/volleytime/actions/runs/36476869854) success на `3595b7f`, полное дерево merge идентично head. Исторические ожидания 3.11.8 выше закрыты. Общая **8.10.3** и post-deploy Telegram-host/pilot acceptance остаются отдельными; `prod`/VPS v0.1.5 не менялись.

---

## R1 — Automation & Reliability `v0.2.0`

> Делает эксплуатацию MVP низкозатратной: платформа работает сама.

### Цель

Напоминания (24ч/2ч), авто-закрытие записи, авто-финиш событий, waitlist confirm-flow (предложение с подтверждением вместо слепого продвижения), надёжная доставка критичных уведомлений (очередь с retry).

### Состав

- **Phase 15** (эпики 15.1-15.8): pg-boss scheduler, reminders, TTL-переходы, waitlist confirm-flow, notify-очередь

### Когда делать

После того как MVP отработал и ручное ведение стало утомлять (обычно — когда >1 события в неделю или растёт число игроков). Job runner (pg-boss) заодно — фундамент для онлайн-оплат R4.

---

## R2 — Multi-Company Beta `v0.3.0`

> Открытие платформы для нескольких внешних организаторов. Гейт перед монетизацией.

### Цель

Подключить 2-5 внешних компаний, собрать обратную связь, измерить готовность платить.

### Состав

- **Phase 10** (эпики 10.1-10.6): allowlist, feedback-кнопка, super-admin обзор, FAQ, ops-runbooks, гейт-метрики
- Полевая работа: onboarding, поддержка, feedback-сессии

### Гейт → R3

≥2 активных организатора, ≥1 с ретеншном ≥4 недели, ≥1 готов платить. При провале — доработки/pivot.

---

## R3 — Monetization `v1.0.0`

> Первая версия, приносящая доход. Требует пройденного гейта R2 + готового юр-статуса (Трек A ✅).

### Цель

Компании платят за создание событий (event credits). Настраиваемая тарифная сетка, покупка через заявку + подтверждение.

### Состав

- **Phase 7** (эпики 7.1-7.8): credit account, demo-квота, spend/refund, тарифная сетка, заявки, root-admin

---

## R4+ — Growth Modules (детализация по факту беты)

| Релиз              | Версия   | Фазы  | Что даёт                                                                                     |
| ------------------ | -------- | ----- | -------------------------------------------------------------------------------------------- |
| R4 Payments Online | `v1.1.0` | 12,13 | bePaid: мгновенная покупка credits + оплата игроками онлайн (активирует TTL pending из 15.6) |
| R5 Contributions   | `v1.2.0` | 11    | Добровольные сборы (на инвентарь, поездки)                                                   |
| R6 Reports         | `v1.3.0` | 14    | Отчёты, экспорт CSV, финансовая аналитика                                                    |
| R7 Competitions    | `v2.0.0` | 16,17 | Матчи + турнирные сетки (порт Level Volley)                                                  |
| R8 CRM Pro         | `v2.1.0` | 18    | Продвинутый CRM для крупных клубов                                                           |

> Эти релизы — phase-card скелеты. Детальные задачи писать ПЕРЕД соответствующим релизом, с учётом обратной связи предыдущих. Приоритет и содержание почти наверняка изменятся после реальной эксплуатации.

---

## Версионирование (SemVer)

- `v0.x` — до product-market fit (MVP, автоматизация, бета)
- `v1.0.0` — первая монетизируемая версия (R3)
- `v1.x` — модули роста без ломающих изменений
- `v2.0.0` — крупный скачок (соревнования — новый домен)

Патч-релизы (`v0.1.1`, `v0.1.2`...) — багфиксы и мелкие доработки внутри релиза (fast-follow).

## Связанные документы

- [ROADMAP.md](./ROADMAP.md) — фазы и последовательность реализации
- [GITHUB_SETUP.md](./GITHUB_SETUP.md) — milestones, labels, задачи→issues
- [operations/status/current-state.md](./operations/status/current-state.md) — текущий статус
