---
id: '9'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'Production deploy на российском VPS. 4 контейнера (caddy/web/bot/postgres), webhook, S3-бэкапы, Sentry+UptimeRobot, CI/CD. Email-провайдер отложен.'
estimated_hours: '15-25'
depends_on: ['8']
---

# Phase 9: Production Deploy

**Цель.** Volley Time доступен 24/7 на volleytime.by. Российский VPS, Docker (4 контейнера), Caddy (auto-HTTPS), webhook бота, ежедневные бэкапы в S3, мониторинг (Sentry + UptimeRobot), CI/CD через GitHub Actions.

## Контекст

Phase 8 завершил MVP (логика + Telegram). Но всё работает локально (long-polling, dev). Phase 9 выводит в production: реальный домен, HTTPS, webhook, автоматический деплой, бэкапы, мониторинг.

**Архитектурный учёт Phase 8:** web и bot — раздельные процессы. bot держит grammY + internal notify endpoint (web→bot). В production: webhook (публичный, от Telegram через Caddy) и internal notify (приватный, web→bot по внутренней docker-сети) — разделены.

## Предусловия

- ✅ Phase 8: MVP работает локально (long-polling, internal transport web→bot)
- ✅ DEPLOY.md: стратегия зафиксирована (Selectel/Timeweb, Caddy, Docker, S3, Sentry+UptimeRobot, Actions)
- ✅ Phase 3 (3.7/3.8): Vitest + GitHub Actions CI базово настроены

## Definition of Done

1. ✅ Mini App доступен по https://volleytime.by (HTTPS через Caddy/Let's Encrypt)
2. ✅ Бот работает 24/7 через webhook (не long-polling)
3. ✅ 4 контейнера: caddy, web, bot, postgres (docker-compose.prod)
4. ✅ Internal notify (web→bot) по внутренней docker-сети, не публичный
5. ✅ VPS provisioned (Ubuntu 24.04, SSH-доступ, firewall, Docker)
6. ✅ DNS volleytime.by → VPS, Mini App domain в BotFather
7. ✅ /health проверяет БД-коннект, UptimeRobot пингует
8. ✅ Sentry ловит исключения (web + bot)
9. ✅ Ежедневный pg_dump → S3, ретенция, ТЕСТ восстановления пройден
10. ✅ CI/CD: push в main → build → деплой на VPS, миграции отдельным шагом
11. ✅ Секреты через GitHub Secrets → .env на VPS

## Критерий готовности

✅ Реальная группа может пользоваться Volley Time через Telegram 24/7: бот отвечает, Mini App открывается по HTTPS, данные сохраняются, при сбое приходит alert, есть свежий бэкап.

## Архитектура развёртывания

```
                    Internet
                       │
                  [Caddy :443]  ← Let's Encrypt auto-HTTPS
                  /          \
        volleytime.by    /tg/webhook/<secret>
             │                  │
        [web :3000]        [bot :8443 webhook]
             │                  │
             └──→ [bot :3001 internal notify]  (внутренняя docker-сеть)
             │                  │
             └────→ [postgres :5432] ←─────────┘
                       │
                  [volume] → pg_dump → S3 (cron)
```

## Эпики

| ID                                     | Эпик                                                  | Задач | Часов |
| -------------------------------------- | ----------------------------------------------------- | ----: | ----: |
| 9.1                                    | Контейнеризация (Dockerfile web + bot)                |     2 |   2-3 |
| 9.2                                    | docker-compose.prod + Caddy (HTTPS, internal network) |     2 |   3-4 |
| 9.3                                    | VPS provisioning (SSH, firewall, Docker, hardening)   |     2 |   2-4 |
| 9.4                                    | DNS + домен + Mini App config (BotFather)             |     1 |   1-2 |
| 9.5                                    | Bot webhook (переключение с long-polling)             |     2 |   2-3 |
| 9.6                                    | /health + мониторинг (Sentry, UptimeRobot)            |     2 |   2-3 |
| 9.7                                    | Бэкапы (pg_dump → S3, cron, restore test)             |     2 |   2-3 |
| 9.8                                    | CI/CD (GitHub Actions, миграции, секреты)             |     3 |   3-4 |
| [9.9](../epics/9-9-review-fixes.md)    | **Исправления по ревью v0.1.0**                       |    11 | 20-28 |
| [9.10](../epics/9-10-review2-fixes.md) | **Исправления по повторному ревью v0.1.1**            |     4 |   3-4 |

**Итого:** 8 эпиков, ~16 задач, 15-25 часов.

## Технические заметки

### Утверждённые решения

1. **4 контейнера:** caddy, web, bot, postgres (docker-compose.prod)
2. **PostgreSQL в Docker** (volume), не managed (managed — Phase 14+ при росте)
3. **Webhook на основном домене**, секретный путь /tg/webhook/<secret> + Telegram secret_token
4. **Internal notify** (web→bot) только внутренняя docker-сеть (bot:3001), не публичный
5. **Mini App на корне** volleytime.by (лендинг — Phase 10/маркетинг)
6. **Caddy auto-HTTPS** (Let's Encrypt, авто-продление)
7. **Бэкапы:** ежедневный pg_dump → S3 (Selectel Object Storage), ретенция 14-30 дней, тест восстановления
8. **Мониторинг:** Sentry (web+bot ошибки) + UptimeRobot (/health) + stdout логи
9. **/health глубокий:** проверяет Postgres-коннект
10. **CI/CD:** GitHub Actions build → ghcr.io → SSH pull + up; fallback build-on-VPS если ghcr недоступен из РФ
11. **Миграции** отдельным шагом деплоя (drizzle migrate перед перезапуском web)
12. **Секреты** через GitHub Secrets → .env на VPS

### Что НЕ делаем в Phase 9

- ❌ Email-провайдер (Unisender Go) — ОТЛОЖЕН. Telegram auth основной. Браузерный email-логин в production временно не шлёт коды (подключим позже, Phase 10/15)
- ❌ Managed PostgreSQL — Phase 14+
- ❌ Метрики/Grafana/Prometheus — Phase 14+
- ❌ Горизонтальное масштабирование, балансировщик — после роста
- ❌ Staging-окружение отдельное — можно добавить, но MVP = single prod (тест восстановления бэкапа локально/временно)
- ❌ CDN — после MVP
- ❌ Лендинг/маркетинг страницы — Phase 10

### Важное замечание про email в production

Email-провайдер отложен (решение 14). Последствия:

- Telegram Mini App auth работает полностью (initData, основной путь)
- Браузерный email-логин (3.4.2) в production НЕ отправляет коды (нет провайдера)
- Для MVP приемлемо: пользователи приходят через Telegram
- Email подключается в отдельной задаче позже (когда понадобится веб-вход вне Telegram)

## Ссылки

- [DEPLOY.md](../guides/DEPLOY.md) — детальный гайд (провайдеры, конфиги)
- [STACK_DECISIONS.md](../architecture/STACK_DECISIONS.md#hosting-российский-vps-phase-9)
- [8-4-1-notifier-transport.md](../tasks/8-4-1-notifier-transport.md) — internal transport
- [3-5-1-grammy-init.md](../tasks/3-5-1-grammy-init.md) — long-polling (переключаем на webhook)
