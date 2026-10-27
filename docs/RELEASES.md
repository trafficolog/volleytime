# Релиз-план Volley Time

> **v0.2.0 выложен 2026-10-26, тег и приёмка владельца 2026-10-27:** production `6143f4256b9da555a90249aeb7de2ccac022521e`, тег `v0.2.0`, [Deploy 40355995553](https://github.com/trafficolog/volleytime/actions/runs/40355995553) success (миграции 0021–0031, smoke-passed), [main CI 40349167990](https://github.com/trafficolog/volleytime/actions/runs/40349167990) all4 success. Новые флаги выключены и включаются по одному после выпуска. Откат приложения на `b056806` не исполнялся, отчёта о проверках на устройствах нет ([Не проверено](operations/qa/2026-10-27-v0-2-0-production-release.md#не-проверено-и-открыто)). [Evidence](operations/qa/2026-10-27-v0-2-0-production-release.md).

> **2026-10-12 — референс v3 целевой:** следующие релизы — v0.2.0 (запись и ядро), v0.3.0 (MVP организатора), v0.4.0 (Root Admin), v0.5.0–v0.7.0; см. раздел [«Референс v3»](#референс-v3-релизы-v020v070). Прежние R1–R3 заменены.

> **R0.7/v0.1.7 принят владельцем, 2026-10-11:** production `e293e069dfc637db835c36a477639379c7e2bcb3` опубликован [Deploy37673966652](https://github.com/trafficolog/volleytime/actions/runs/37673966652) после PR94 и exact-head/main CI all4SUCCESS. Пользователь подтвердил реальную двухаккаунтную Telegram matrix на Android/Desktop, повторные финансовые операции и pilot acceptance; [итоговое evidence и ограничения покрытия](operations/qa/2026-10-11-r07-pilot-acceptance.md).9.8.11 done; immutable tag/Release оформляются на production SHA после reviewed closure-docs CI/merge. R0.6 historical и полная R0 operational/week-long acceptance отдельно открыты. Нижние checkpoints исторические, без необходимости повторять unchanged tests/deploy.

> **R0.7 production-кандидат опубликован, 2026-10-06:** PR92 принят после review/exact-head CI; merged `d98ed97b1ef81dd695f4a94aafbfeafc90d4836c` прошёл [exact-main CI37419085625](https://github.com/trafficolog/volleytime/actions/runs/37419085625), all4SUCCESS. [Deploy37419396620](https://github.com/trafficolog/volleytime/actions/runs/37419396620) SUCCESS: GitHub main/prod и VPS Git/images/runtime/public health совпали на d98ed97, новый backup предшествовал migrations, synthetic auth/forgery/cleanup и smoke-passed подтверждены. [Production evidence и ручная matrix](operations/qa/2026-10-06-r07-production-candidate.md).9.8.14 done;9.8.11/release остаются in_progress до двух реальных Telegram аккаунтов и owner pilot acceptance, tag/Release отсутствуют. Историческая R0.6 manual acceptance отдельно открыта. Нижние pending checkpoints не означают необходимость повторять unchanged QA или redeploy.

> **R0.7 deploy recovery checkpoint, 2026-10-05:** полный `bbd6f41e518f916b14d36180d5e510cf9fadaefc` принят PR91/[exact-main CI37327727365](https://github.com/trafficolog/volleytime/actions/runs/37327727365). [Deploy37328474440](https://github.com/trafficolog/volleytime/actions/runs/37328474440) завершился pre-VPS на test gate (1310 passed / 6 failed): exact PostgreSQL service ID не передан в Deploy `pnpm test`, build/deploy skipped. [Task9.8.14](tasks/9-8-14-deploy-postgres-test-identity.md) фиксирует scoped local RED→GREEN/env correction и отдельные frozen gates; independent review/exact-head CI/PR/main/exact-main CI ещё обязательны. Product business/schema/UI unchanged. Controller live audit подтверждает production967aff3, smoke-passed/healthy и отсутствие bbd staging. Controlled deploy, Telegram/pilot/owner acceptance/tag/Release открыты; 9.8.11/release `in_progress`. Нижние checkpoint исторические.

> **Authoritative R0.7 code/pre-deploy checkpoint, 2026-10-05:** все шесть feature tasks и follow-ups9.8.12/9.8.13/8.11.3 приняты; PR86–90 интегрированы в exact main `003968944c4e5f5f3a48685c2deb316e0e8a014a`, [CI37294307936](https://github.com/trafficolog/volleytime/actions/runs/37294307936) all4SUCCESS и merge/head tree identical. Все802 tracked paths вне docs/ literal byte-identical accepted original22c0850; final Chrome100/native200 accepted within recorded limits. [Provenance/closure-map](operations/qa/2026-10-05-r07-final-code-checkpoint.md) и frozen final local gate report отделяют code acceptance от controller final review/docs-head/main CI и deployment/manual acceptance.9.8.11/release `in_progress`, M8/M9 deferred; production по последнему подтверждённому deploy967aff3, capability/tag/Release не продвинуты. Нижние checkpoints исторические.

> **Task7 scoped review принят, 2026-10-04:** оба Important закрыты на `bafd9bb`, новых Critical/Important в исправлениях нет; пять локальных gates PASS. Разрешён code/local PR checkpoint9.8.11 со статусом `in_progress`, но merge требует exact-head Actions CI. Итоговые integrated-main gates/whole-branch review/CI и controlled deploy/Telegram/pilot остаются обязательными до окончательного выпуска. Production `967aff3` без изменений.

> **Task7 fix round1 checkpoint, 2026-10-04:** `bafd9bb`, пять финальных gates PASS (154 файла / 1220 тестов). Исправления review по hostname/network resolution и PostgreSQL CI transport ожидают независимое scoped re-review и exact-head CI. Предыдущий сбой временного Git fixture сохранён отдельно; повторный полный прогон прошёл на неизменных исходниках. Task9.8.11 остаётся `in_progress`; integrated-main, controlled deploy и реальная Telegram/pilot acceptance ещё открыты, prod `967aff3` без изменений.

> **Task7 review checkpoint, 2026-10-03:** локальный rollback code checkpoint `ed0def9` имеет пять зелёных gates (153 файла / 1193 PostgreSQL-теста), но пока не принят: независимое review требует устранить два Important по hostname/network resolution и CI test-container contract. Исправления проходят отдельные RED→GREEN, новые gates и scoped review. Task9.8.11 остаётся `in_progress`, production `967aff3` и release/tag не продвигаются.

> **Task5 принят, 2026-10-03:** [PR85](https://github.com/trafficolog/volleytime/pull/85) merged в main `ebfc5bf` после [exact-head CI37133275458](https://github.com/trafficolog/volleytime/actions/runs/37133275458): все4success на `8e29442`, включая runner image bundle. Merged tree совпадает с принятым PR, source/local Chrome QA независимо приняты; Task8.11.2 done. Последующая задача9.8.11 реализует rollback/quiescence и готовит полный выпуск; integrated-main review/gates/CI, production и real Telegram/pilot acceptance открыты. Prod967aff3/VPS/capability/tag не изменены; предыдущие pending checkpoints ниже исторические.

> **Task5 local QA checkpoint, 2026-10-03:** `e4634cd`, source re-review без открытых Important/Critical после scoped fixes, пять gates PASS (151files/1150PGtests). Локальная Chrome player/landing matrix выполнена; [QA evidence](operations/qa/2026-10-02-player-split-chrome.md) ожидает независимую финальную приёмку. Task8.11.2 in_progress до exact-head CI/PR/merge; Task9.8.11 todo. Main035ee142/prod967aff3 сверены API, VPS/capability/tag не менялись. Исторические записи ниже не означают текущие блокеры; реальная Telegram/pilot acceptance отдельно открыта.

> **Task4 принят, 2026-10-02:** PR84 merged в main035ee142 после exact-head CI37021357261 (все4success на b27cd789), source re-review/local QA acceptance и свежих пяти gates. Task5.16.2 done; UI игрока8.11.2 начинается отдельно, rollback/release9.8.11 остаётся обязательной открытой задачей. Prod967aff3/VPS/capability/tag не изменены. Прежние checkpoints ниже исторические; они не закрывают реальную Telegram/pilot приёмку.

> **Task4 Chrome checkpoint, 2026-10-02:** локальные проверки форм, native cancel/confirm, распределения и visual matrix320/390/1280 light/dark завершены; настоящий Chrome200% проверен, успешный desktop compositor frame просмотрен inline контроллером (не сохранён как PNG). [Канонический QA-report](./operations/qa/2026-10-02-organizer-split-chrome.md) фиксирует границы evidence. Независимый acceptance supplement PASS с исправленным здесь замечанием D1 к rollup. Свежие пять gates PASS (147files/1075tests); Task4 in_progress, exact-head CI/PR/merge открыты. Этот checkpoint заменяет прежний локальный checklist, но не закрывает Tasks5/7 и production/manual acceptance.

> **R0.7 checkpoint 2026-10-02:** Tasks 1/2/3/6 приняты в GitHub main; PR #83 merged, `main=8dd26b413d30a9d8ac6c8b11fae93ae87063d7d8`, integrated CI `36840806743` success (сверено через GitHub API). Task 4 / 5.16.2 — in_progress: локальный `cad35c35`, I1/I2 исправлены и отдельный re-review PASS, пять gates PASS (147 файлов / 1075 тестов). Нативное подтверждение, новые controls при 200%, exact-head CI и merge ещё открыты. Tasks 5/7 остаются todo. `prod=967aff312f962196e7347cc0e50f879f25f6dffa`; продвижения production не было. Нижние checkpoints исторические.

> **R0.7 checkpoint 2026-10-01:** Tasks 1–3 приняты через PR #80/#81/#82; финальный CI Task 3 `36836542260` success, main/base Task 6 `73e18757db0a7055f8bfcb5dc0055fb9c835b1a1`. Task 6 / 6.11.2 — in_progress: локально 3×37 денежных тестов и пять gates PASS (143 файла / 1031 тест); review/CI/merge открыты. Tasks 4/5 (UI) и 7 (release) открыты. Controller разрешил Task 6 перед UI, поскольку обе зависимости 6.11.1/8.11.1 приняты. Это не закрывает production/Telegram/pilot acceptance.

> Привязка фаз/эпиков/задач к релизам. Определяет точку MVP и последующие этапы.
> **Номер фазы = ID (не порядок).** Релизы группируют фазы по бизнес-ценности.
> Для ведения в GitHub: каждый релиз = **milestone**, каждая задача = **issue** (см. [GITHUB_SETUP.md](./GITHUB_SETUP.md)).

## Обзор релизов

| Релиз                      | Версия    | Цель                                            | Фазы           |  Задач | Оценка                                        |
| -------------------------- | --------- | ----------------------------------------------- | -------------- | -----: | --------------------------------------------- |
| **R0 — MVP**               | `v0.1.0`  | **Бот для ОДНОЙ компании: записи + учёт**       | 3,4,5,6,8,9    |    139 | ~205-285 ч                                    |
| **v0.2.0 — Ref MVP: ядро** | `v0.2.0`  | Mini App игрока и ядро кабинета по референсу v3 | 19,20          |     41 | выкладка 2026-10-26, тег и приёмка 2026-10-27 |
| **v0.3.0 — Ref MVP: орг.** | `v0.3.0`  | Mini App организатора и все разделы кабинета    | 21             |     26 | см. карточки                                  |
| v0.3.1 — Огрехи и чистка   | `v0.3.1`  | Огрехи v0.2.0–v0.3.0, чистка наследия до-v3     | 21 (21.4–21.5) |      5 | см. карточки                                  |
| v0.4.0 — Root Admin        | `v0.4.0`  | Админка платформы                               | 22             |      9 | см. карточки                                  |
| v0.5.0 — Личное и SEO      | `v0.5.0`  | Флаги функций, календарь, SEO-страницы, лендинг | 23,24          |     10 | см. карточки                                  |
| v0.6.0–v0.7.0 — Гипотезы   | `v0.6.0`+ | Гипотезы для игроков за флагами                 | 25,26          |     11 | см. карточки                                  |
| Payments Online (backlog)  | —         | Онлайн-оплата (bePaid): баланс + игроки         | 12,13          | скелет | ~55-75 ч                                      |
| Competitions (backlog)     | —         | Матчи + турниры (порт Level Volley)             | 16,17          | скелет | ~110-150 ч                                    |
| CRM Pro (backlog)          | —         | Продвинутый CRM                                 | 18             | скелет | ~80-120 ч                                     |

**Расписаны детально:** R0 (выполнен, v0.1.0–v0.1.7) и референс v3 v0.2.0–v0.7.0 (фазы 19–26, 101 задача, включая 5 задач `v0.3.1`). Сборы (11) и отчёты (14) вошли в v0.3.0; backlog-строки детализируются по решению владельца.

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

## R0.6 — MVP UI refresh `v0.1.6` (production-кандидат; Telegram QA открыт)

2026-09-30 **исправленный полный кандидат опубликован:** [Deploy 36772178900](https://github.com/trafficolog/volleytime/actions/runs/36772178900) success на `967aff312f962196e7347cc0e50f879f25f6dffa` после PR #71–77, финальных пяти gates (135 файлов/907 тестов), review и exact-head/main CI. Все пять pilot UI fixes на VPS; offline-runtime acceptance 9.8.10 закрыта. Новый проверенный backup создан до миграции; точный SHA, healthy services и synthetic smoke/cleanup подтверждены в [production evidence](./operations/qa/2026-09-30-r06-production-candidate.md#corrected-rollout-and-pilot-ui-fixes). Real Telegram regression и оставшаяся двухаккаунтная matrix/pilot — открытая post-deploy приёмка; tag/GitHub Release не публикуются до неё. Прежние ожидания CI/redeploy ниже исторические.

Итоговый локальный pilot-fix gate2026-09-30: общий test135/907 и остальные четыре gates прошли; whole-branch review без Critical/Important, docs-only clarification прошла re-review. Повторный Chrome и read-only VPS preflight завершены; выбранный финальный head/main CI и controlled redeploy ещё не выполнены. Runtime-source после пяти PR не менялся; подробности и deferred Minor — в [QA report](./operations/qa/2026-09-30-r06-pilot-ui-fixes.md). Telegram regression/pilot остаются отдельной post-deploy приёмкой.

2026-09-30 **pilot UI fixes приняты в main:** PR #72–76 закрывают 8.10.7, 3.11.11–13 и 8.10.8 после отдельных RED→GREEN, browser QA, пяти gates и независимых reviews/exact-head CI. Runtime-source `575ca06576e40a40e99340081b81b559243057a1`; [QA report](./operations/qa/2026-09-30-r06-pilot-ui-fixes.md) хранит точные результаты и отдельные promotion/Telegram gates. Offline fix9.8.10 также принят PR #71 (head/main CI passed), но исправленная выкладка ещё не выполнена. Production остаётся64f1850 до общего финального gate и runbook deploy с новым backup; после него обязательны Telegram regression пяти замечаний и оставшаяся двухаккаунтная matrix/pilot. Предыдущие записи ниже исторические, не актуальное ожидание уже завершённых PR.

2026-09-30 **локальный offline-runtime fix 9.8.10:** после RED commits `ee8d752`/`33fd8c0` мигратор запускает bundled `tsx` через Node, а packaging проверяет final CLI с отключённой сетью до export. Real final image применил все 20 миграций и успешно повторил запуск в isolated PostgreSQL 16 при заблокированном outbound npm. Updated CI, independent review и controlled redeploy ещё требуются; production и Telegram acceptance этим локальным smoke не подтверждаются.

2026-09-30 **кандидат развёрнут, но релиз ещё не принят:** [9.8.10 production evidence](./operations/qa/2026-09-30-r06-production-candidate.md) фиксирует PR #70, exact-head/main CI, reviewed fast-forward `main → prod` и успешный [Deploy 36747623989](https://github.com/trafficolog/volleytime/actions/runs/36747623989) на `64f18506b03081bc7b9c065c8371cd3e62f10b30`. На VPS совпали Git, три SHA-образа, web/bot/public health; backup БД создан и проверен до миграции, synthetic auth/forgery/cleanup smoke прошёл. Однако мигратор скачал `pnpm` из npm registry внутри контейнера при активации: offline-VPS критерий 9.8.10 ещё не выполнен, требуется фикс и повторная проверка. Настоящий Telegram QA на двух аккаунтах и пилотная приёмка также открыты; immutable tag/GitHub Release `v0.1.6` пока не публикуются. Записи ниже описывают предшествующие checkpoint, а не текущее состояние production.

2026-09-30: после выкладки кандидата пользователь предоставил Telegram-скриншоты и открыл пять отдельных pilot UI fixes: **8.10.7** (полный статус события), **3.11.11** (без синих декоративных теней), **3.11.12** (брендовые native radio), **3.11.13** (различимые поля на серых поверхностях), **8.10.8** (стабильные микрофильтры событий). Для каждой обязательны RED→GREEN, собственные пять gates, browser QA, независимое review и CI. До интеграции и controlled redeploy этих исправлений финальная приёмка R0.6 остаётся открытой. Подробное production evidence и отдельное offline-migrator исправление 9.8.10 ведутся в своей ветке и не подменяются этой записью.

2026-09-30 **9.8.10 PR #70 recovery review-fix:** локальные RED→GREEN и пять gates прошли; исправлено доказательство env для отката в историческом partial state и проверка незавершённой image-bundle фазы перед ручным GHCR. Независимое scoped review закрыло оба Important без нового блокера. Прежний CI относится к старому SHA; обновлённый PR/head и затем exact-main CI обязательны до fast-forward `prod`. Production deploy, реальный Telegram QA и принятие `v0.1.6` ещё не выполнены.

Task 6 (2026-09-30): пять локальных gates прошли, PostgreSQL 127 files/795 tests, focused contracts 90/90, shell/YAML/diff checks. Lint: 0 errors/12 baseline warnings; typecheck/build использовали Turbo cache. Self-review документации не заменяет independent whole-branch review, exact-head CI или controlled production acceptance.

2026-09-30 **9.8.10 — локальный deploy checkpoint**: image-bundle становится default в новой workflow-реализации: runner build/export → private SSH transfer → verify/load → backup → exact Git advancement → migrate → `up --no-build` → exact synthetic smoke/cleanup. [Runbook](./operations/runbooks/deploy.md) описывает partial-state recovery и exact rollback к подтверждённому runtime; GHCR остаётся explicit manual-вариантом с неизменным env и согласованными checkout/manifest/runtime. Локальные проверки Task 6 не подтверждают production rollout. До продвижения обязательны independent whole-branch review, exact-head CI и merge-tree/main CI; затем reviewed fast-forward `prod` и controlled production evidence. [9.8.10](./tasks/9-8-10-registry-free-image-bundle-deploy.md) остаётся `in_progress`, Telegram 8.7.2/8.8.11 и отдельное принятие пилота открыты; `v0.1.6` не тегирован и не объявлен выпущенным.

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

## R0.7 — MVP: режим оплаты события `v0.1.7` (acceptance выполнена)

Текущий статус2026-10-11: production e293e06/Deploy37673966652, техническая и user-reported двухаккаунтная Android/Desktop matrix приняты владельцем.9.8.11 done, recovery9.8.14 done; [итоговое evidence](operations/qa/2026-10-11-r07-pilot-acceptance.md). Новый immutable tag/Release оформляется на exact production SHA после closure-docs CI/merge, без redeploy. Исторические R0.6 и полные R0 operational gates отдельно открыты.

### Исторические checkpoints реализации (2026-10-01–05)

Исторический status2026-10-05: полный candidate bbd6f41 принят PR91/exact-head/main CI; Deploy37328474440 failed pre-VPS на missing PostgreSQL test identity. Scoped recovery [9.8.14](./tasks/9-8-14-deploy-postgres-test-identity.md) тогда реализован локально с отдельными RED/GREEN/frozen-gate evidence, pending independent review/exact-head CI/PR/main/exact-main CI. [Final QA checkpoint](./operations/qa/2026-10-05-r07-final-code-checkpoint.md) сохраняет evidence exact source. На дату checkpoint production был967aff3; тогда controlled deploy/Telegram/pilot/tag оставались открыты. Эти ожидания superseded итоговым evidence выше.

2026-10-01 пользователь подтвердил реализацию fixed/split из дизайн-референса. Это расширение R0/MVP: общая сумма делится на фактически занявших места после ручного закрытия записи; игрок до него видит прогноз, после — собственный точный платёж. Наличные/перевод и действующее подтверждение денег сохраняются, абонементы в split недоступны. R0.6 остаётся выложенным кандидатом с открытой Telegram/pilot приёмкой; будущие задачи её не закрывают.

[Письменная спецификация](./superpowers/specs/2026-10-01-event-split-pricing-design.md) и [план семи задач](./superpowers/plans/2026-10-01-event-split-pricing.md) утверждены пользователем 2026-10-01; выбран Subagent-driven с отдельной проверкой каждой задачи. Распределение остатка копеек, неизменные доли после фиксации и правила выхода согласованы. Задачи 5.16.1 и 6.11.1 приняты в main через [PR #80](https://github.com/trafficolog/volleytime/pull/80) / [CI 36828093886](https://github.com/trafficolog/volleytime/actions/runs/36828093886) и [PR #81](https://github.com/trafficolog/volleytime/pull/81) / [CI 36831883906](https://github.com/trafficolog/volleytime/actions/runs/36831883906). Уведомления 8.11.1 приняты через [PR #82](https://github.com/trafficolog/volleytime/pull/82) / [CI 36836542260](https://github.com/trafficolog/volleytime/actions/runs/36836542260). Task 6 / 6.11.2 принята через [PR #83](https://github.com/trafficolog/volleytime/pull/83), Task 4 / 5.16.2 — через [PR #84](https://github.com/trafficolog/volleytime/pull/84), Task 5 / 8.11.2 — через [PR #85](https://github.com/trafficolog/volleytime/pull/85). Все шесть задач done после acceptance/review/exact-head CI; последний проверенный main `ebfc5bf`, post-merge [CI37133566327](https://github.com/trafficolog/volleytime/actions/runs/37133566327) — все четыре jobs SUCCESS. Release Task 7 / 9.8.11 — in_progress: rollback/local code checkpoint реализуется, final integrated gates/review и production/manual acceptance ещё открыты. Production по последнему подтверждённому deploy остаётся `967aff3`; capability split не включалась, Telegram/pilot acceptance R0.6 и R0.7 не закрыта.

### Текущий статус задач — 2026-10-11

| Задача                                                    | Результат                                                   | Статус |
| --------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| [5.16.1](./tasks/5-16-1-event-pricing-modes.md)           | Модель, валидация, миграция и расчёт копеек                 | done   |
| [6.11.1](./tasks/6-11-1-split-booking-settlement.md)      | Запись и атомарное распределение/платежи                    | done   |
| [8.11.1](./tasks/8-11-1-split-pricing-notifications.md)   | Запись без ложной оплаты и персональное уведомление расчёта | done   |
| [5.16.2](./tasks/5-16-2-organizer-split-pricing-ui.md)    | Mini App/desktop организатора                               | done   |
| [8.11.2](./tasks/8-11-2-player-split-pricing-ui.md)       | Игрок, roster/deep links и применимый лендинг               | done   |
| [6.11.2](./tasks/6-11-2-split-money-race-tests.md)        | Денежные гонки и сквозная интеграция                        | done   |
| [9.8.11](./tasks/9-8-11-split-pricing-release-qa.md)      | Общая QA, controlled deploy и Telegram/pilot acceptance     | done   |
| [9.8.14](./tasks/9-8-14-deploy-postgres-test-identity.md) | PostgreSQL service identity в deploy test gate              | done   |

DoD: каждая task branch/PR принята после RED→GREEN, собственных пяти gates, review и exact-head CI. Release-задача 9.8.11 имеет промежуточный merge checkpoint: code/local acceptance + свежие review + exact-head CI → merge в main со статусом in_progress и открытыми deployment/manual критериями; затем integrated-main gates/review/exact-main CI → reviewed FF prod → Actions deploy с backup-before-migrations/exact SHA/runtime smoke → реальная Telegram/pilot acceptance. Только финальное evidence закрывает карточку/релиз и разрешает tag/Release v0.1.7. Полный кандидат проходит визуальную/функциональную matrix; создание split включается capability только для полного кандидата.

Rollback boundary: existing image/data preflight сохраняется. Перед authoritative downgrade DB query под deploy lock захватить exact active web/bot IDs/images, остановить всех project writers (duplicate/scaled тоже), доказать отсутствие running writers; только затем query schema/split rows. До guard не менять Git/manifest/env и не активировать images; повторить writer absence перед switch, удерживать quiescence до old activation. In-flight split либо commit до query и блокирует fixed-only downgrade, либо rollback; новый split в guard→activation window не commit. Query error/несовместимость запрещают downgrade: до stop runtime неизменен, после stop recovery только captured compatible current containers/images, exact state сообщается при отказе. Manual/automatic recovery не использует unsafe old fallback, DB restore или удаление split-данных. Пауза только при rollback, без нового persisted feature table/global advisory lock.

Вне scope: multi-seat, online payment, credits, сборы, отчёты, автоматическое закрытие/scheduler и новая анонимная event page. Полная сумма распределяется по одному месту на игрока с сохранением до копейки, финансовые операции ledger остаются append-only.

---

## Референс v3: релизы v0.2.0–v0.7.0

Решение владельца 2026-10-12: референс v3 ([docs/design/reference-v3](design/reference-v3/README.md)) — целевой. Прежние R1 (Automation), R2 (Beta) и R3 (Monetization) заменены: автоматизация и баланс событий входят в v0.2.0–v0.4.0, бета — после v0.4.0. Состав задач, модели и порядок — в карточках фаз 19–26, [ROADMAP](./ROADMAP.md#референс-v3-фазы-1926) и [ORCHESTRATION](./ORCHESTRATION.md).

Общий DoD каждого релиза v3:

- все задачи релиза `done`: RED→GREEN, пять gates на tested revision, ревью моделью `review_model` без Critical/Important, exact-head и main CI;
- отчёт визуальной сверки ([19.0.2](./tasks/19-0-2-visual-reference-harness.md)) по экранам релиза без открытых Critical/Important;
- Telegram QA на двух реальных аккаунтах (Android и Desktop) для экранов Mini App и бота;
- выкладка через **Promote to production** ([9.8.17](./tasks/9-8-17-gated-prod-promotion.md)): backup до миграций, exact SHA, health, smoke и cleanup, проверенный путь отката;
- приёмка владельца и неизменяемый тег на production SHA.

Решения владельца [D-01…D-11](./operations/decisions/2026-10-12-reference-v3-decisions.md) приняты 2026-10-12 по рекомендациям оркестратора.

### v0.2.0 — Reference MVP: запись и ядро

**Статус: выкладка 2026-10-26, тег и приёмка владельца 2026-10-27.** Production `6143f4256b9da555a90249aeb7de2ccac022521e`, аннотированный тег `v0.2.0` на этом SHA (опубликован 2026-10-27); выкладка — [Deploy 40355995553](https://github.com/trafficolog/volleytime/actions/runs/40355995553) (миграции 0021–0031, backup до миграций, smoke и cleanup). Promote отказал (диапазон меняет workflows, `PROMOTE_TOKEN` не задан), поэтому `prod` продвинут вручную по runbook с подтверждением владельца. Evidence: [выпуск в production](operations/qa/2026-10-27-v0-2-0-production-release.md), [чеклист владельца](operations/qa/2026-10-26-20-7-1-owner-checklist.md), [сверка экранов](operations/qa/2026-10-26-20-7-1-release-visual.md), [решение о приёмке](operations/decisions/2026-10-12-reference-v3-decisions.md). Владелец принял релиз, указав на небольшие огрехи; они оформляются отдельными задачами. Откат приложения на `b056806` не исполнялся, отчёта о проверках на устройствах нет ([Не проверено](operations/qa/2026-10-27-v0-2-0-production-release.md#не-проверено-и-открыто)).

Флаги `EVENT_BALANCE_ENFORCED`, `EVENT_MULTI_SEAT_ENABLED`, `EVENT_INVITE_MODE_ENABLED`, `SCHEDULER_ENABLED` в production **выключены**, `TELEGRAM_LOGIN_WIDGET_ENABLED` проведён в `main` (#185); в production переменная пока отсутствует — появится со следующим релизным коммитом; включаются по одному, каждый отдельным релизным коммитом и с подтверждением владельца ([раздел 6 чеклиста](operations/qa/2026-10-26-20-7-1-owner-checklist.md)).

Фазы [19](./phases/19-foundation-v3.md) и [20](./phases/20-booking-core-v3.md), 41 задача, релизная задача [20.7.1](./tasks/20-7-1-release-v0-2-0-qa.md). Фазы 19 и 20, все их эпики и 41 карточка — `done` (статусы сверены 2026-10-27); хвосты, не блокирующие закрытие, — в разделе [Follow-up](./tasks/20-7-1-release-v0-2-0-qa.md#follow-up-после-выпуска).

Игрок в Mini App v3 записывается на несколько мест, видит цену fixed/split, очередь и отмену по политике группы, получает уведомления в ленте и в боте. Организатор входит в кабинет v3, создаёт событие или серию со списанием баланса событий, управляет составом. Планировщик открывает и закрывает запись, финализирует split, напоминает. Публичная страница события открывается без входа.

Операционные условия до приглашения внешних организаторов (не блокируют выкладку для пилотной группы): мониторинг ошибок и uptime (9.6.1, 9.6.2), S3-бэкап и проверка восстановления (9.7.1, 9.7.2).

Привязка группового Telegram-чата к группе и анонс события в чат — отдельная задача [20.3.4](./tasks/20-3-4-group-chat-link.md) (решение владельца 2026-10-19); от неё зависит пункт «В чат группы» меню строки в [20.5.8](./tasks/20-5-8-events-payments-row-menu.md).

Вне релиза: онлайн-оплата, сборы, отчёты, Root Admin, гипотезы.

### v0.3.0 — Reference MVP: организатор

Фаза [21](./phases/21-organizer-mvp-v3.md), 26 задач, релизная задача [21.3.1](./tasks/21-3-1-release-v0-3-0-qa.md).

Все экраны Mini App организатора и кабинета из референса: игроки с уровнями, касса с выгрузкой, сборы (кабинет и Mini App, игрок вносит взнос), абонементы, отчёты и экспорт, баланс событий с покупкой через заявку, уведомления. Цифры денег совпадают между Mini App, кабинетом и кассой.

Кнопки макета бота «Буду», «Пропущу», «Мой абонемент», «Сборы», «Кто уже играет» перенесены в v0.3.0 решением владельца 2026-10-19 (см. [журнал решений](./operations/decisions/2026-10-12-reference-v3-decisions.md)). Владеющей карточки у них пока нет: каждая кнопка требует доменной функции (подтверждение присутствия, досрочный отказ от предложения места, абонемент и сборы в боте) и берётся в план v0.3.0 отдельной карточкой при детализации релиза; до этого — backlog v0.3.0.

Хвосты экранов игрока 20.4.9 перенесены в v0.3.0 решением владельца 2026-10-20 (см. [журнал решений](./operations/decisions/2026-10-12-reference-v3-decisions.md)): кнопка «Оплатить» в «Мои записи» с реквизитами организатора на экране покупки абонемента; статистика профиля (посещения, посещаемость, no-show) и строки «Язык», «Выйти», «Изменить». Владеющей карточки пока нет — backlog v0.3.0 до детализации релиза. Номер абонемента `#SUB`, «поделиться абонементом» и чип «Популярный» — в backlog без даты (нужна модель данных).

«Статус оплаты в API игрока» ([21.1.8](./tasks/21-1-8-player-payment-status-api.md)) добавлен в v0.3.0 решением владельца 2026-10-25 (см. [журнал решений](./operations/decisions/2026-10-12-reference-v3-decisions.md)): строка истории «оплачено, место освобождено» (`payments.seat_released_at`) и точное предупреждение «без возврата» только для оплаченных мест; до неё в v0.2.0 предупреждение D-14 показывается по способу оплаты, как в боте.

Операционная задача релиза: ретенция релизов на VPS и мониторинг свободного места ([9.8.18](./tasks/9-8-18-vps-release-retention.md), решение владельца 2026-10-27); не зависит от экранов релиза.

Вне релиза: Root Admin. До v0.4.0 заявки на баланс подтверждает root операторской командой с записью в журнал (20.2.1).

### v0.3.1 — Огрехи и чистка наследия (patch над v0.3.0)

Эпики [21.4](./epics/21-4-defects-v0-2-v0-3.md) и [21.5](./epics/21-5-legacy-cleanup.md) фазы 21, 5 задач (число растёт карточками исправлений `21.4.4+` и пакетов удаления `21.5.3+`), релизная задача [21.4.3](./tasks/21-4-3-defects-recheck-release.md). Решение владельца 2026-10-27 ([журнал](./operations/decisions/2026-10-12-reference-v3-decisions.md)): после v0.3.0 вернуться к огрехам v0.2.0 и v0.3.0 (ручная проверка владельца и устройств, сверка с макетами) и отдельно найти и удалить наследие до-v3.

- Эпик 21.4: сбор огрехов (21.4.1) → исправление Critical/Important (21.4.2) → перепроверка и релиз (21.4.3).
- Эпик 21.5: read-only аудит наследия (21.5.1, может идти параллельно с фазой 21) → удаление пакетами с тестами и ревью (21.5.2+, после 21.3.1).
- Функций, экранов, данных и миграций релиз не добавляет; удаляется только то, что назвал принятый аудит. `v0.4.0` ждёт `v0.3.1`. Если чистка отстаёт, исправления выходят как `v0.3.1`, остаток чистки — как `v0.3.2`.

### v0.4.0 — Root Admin

Фаза [22](./phases/22-root-admin.md), 9 задач, релизная задача [22.3.2](./tasks/22-3-2-release-v0-4-0-qa.md).

Админка платформы: обзор, организации, пользователи, баланс и тарифы, выдача баланса, журнал действий, настройки платформы. Подписки и выплаты — в объёме решения D-07.

### v0.5.0 — Личные функции, календарь и публичные страницы

Фазы [23](./phases/23-player-features-calendar.md) и [24](./phases/24-public-seo.md), 10 задач, релизная задача [24.1.5](./tasks/24-1-5-release-v0-5-0-qa.md).

### v0.6.0 и v0.7.0 — Гипотезы

Фазы [25](./phases/25-hypotheses-wave-1.md) и [26](./phases/26-hypotheses-wave-2.md). Статус handoff: «гипотезы, не MVP». Каждая — за флагом; старт волны и судьба каждой гипотезы — решение владельца по метрикам 23.1.2.

### После v0.7.0

Private beta (фаза 10 без 10.3), онлайн-оплата (12–13), соревнования (16–17), CRM (18) — по решению владельца; версии назначаются при планировании.

---

## Прежние R1–R3 (заменены референсом v3)

Разделы ниже сохранены как история. Их состав перенесён: фаза 15 → 20.3.1–20.3.2, фаза 7 → 20.2.1, 21.2.8, 22.2.1–22.2.2, эпик 10.3 → 22.1.1. Версии `v0.2.0`, `v0.3.0` и `v1.0.0` из этих разделов больше не действуют.

## R1 — Automation & Reliability `v0.2.0` — заменён

> Делает эксплуатацию MVP низкозатратной: платформа работает сама.

### Цель

Напоминания (24ч/2ч), авто-закрытие записи, авто-финиш событий, waitlist confirm-flow (предложение с подтверждением вместо слепого продвижения), надёжная доставка критичных уведомлений (очередь с retry).

### Состав

- **Phase 15** (эпики 15.1-15.8): pg-boss scheduler, reminders, TTL-переходы, waitlist confirm-flow, notify-очередь

### Когда делать

После того как MVP отработал и ручное ведение стало утомлять (обычно — когда >1 события в неделю или растёт число игроков). Job runner (pg-boss) заодно — фундамент для онлайн-оплат R4.

---

## R2 — Multi-Company Beta `v0.3.0` — заменён

> Открытие платформы для нескольких внешних организаторов. Гейт перед монетизацией.

### Цель

Подключить 2-5 внешних компаний, собрать обратную связь, измерить готовность платить.

### Состав

- **Phase 10** (эпики 10.1-10.6): allowlist, feedback-кнопка, super-admin обзор, FAQ, ops-runbooks, гейт-метрики
- Полевая работа: onboarding, поддержка, feedback-сессии

### Гейт → R3

≥2 активных организатора, ≥1 с ретеншном ≥4 недели, ≥1 готов платить. При провале — доработки/pivot.

---

## R3 — Monetization `v1.0.0` — заменён

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
