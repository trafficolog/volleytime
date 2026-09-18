---
date: 2026-05-29
duration_hours: 2.5
session_type: phase-elaboration
phase: '9'
goals:
  - 'Расписать Phase 9: Production Deploy'
  - 'Вывод MVP в production: VPS, Docker, webhook, бэкапы, мониторинг, CI/CD'
outcomes:
  - 'Phase 9 phase-card переписана (8 эпиков, email отложен)'
  - '16 задач полного формата (1744 строки)'
  - 'Архитектура развёртывания: 4 контейнера, разделение webhook/internal'
---

# Сессия 2026-05-29: Phase 9 (Production Deploy)

## Контекст

После Phase 8 (MVP готов локально) — вывод в production. volleytime.by 24/7, российский VPS, webhook вместо long-polling, бэкапы, мониторинг, автодеплой.

## Утверждённые 14 решений (13 по рекомендациям + 14 изменено)

1. 4 контейнера: caddy, web, bot, postgres
2. PostgreSQL в Docker (volume), не managed
3. Webhook на основном домене, секретный путь + secret_token
4. Internal notify (web→bot) только внутренняя docker-сеть
5. Mini App на корне volleytime.by
6. Caddy auto-HTTPS (Let's Encrypt)
7. Бэкапы pg_dump → S3, ретенция, ТЕСТ восстановления
8. Sentry (web+bot) + UptimeRobot
9. /health глубокий (проверка БД)
10. CI/CD: Actions build → ghcr → SSH; fallback build-on-VPS (РФ)
11. Миграции отдельным шагом деплоя
12. Секреты через GitHub Secrets → .env
13. Вся фаза за раз
14. **Email-провайдер ОТЛОЖЕН** (изменено с A на B) — Telegram auth основной

## Структура Phase 9 (8 эпиков, 16 задач)

| Эпик                    | Задач | Суть                                                              |
| ----------------------- | ----: | ----------------------------------------------------------------- |
| 9.1 Контейнеризация     |     2 | Dockerfile web (Nuxt multi-stage), bot (grammY + internal)        |
| 9.2 compose + Caddy     |     2 | docker-compose.prod (4 сервиса, сети), Caddyfile (HTTPS, routing) |
| 9.3 VPS provisioning    |     2 | SSH/firewall/fail2ban/hardening, Docker + deploy-юзер             |
| 9.4 DNS + домен         |     1 | DNS, BotFather Mini App domain, проверка                          |
| 9.5 Bot webhook         |     2 | webhook режим + secret, разделение webhook/internal listeners     |
| 9.6 health + мониторинг |     2 | /health (БД) + Sentry web, Sentry bot + UptimeRobot               |
| 9.7 Бэкапы              |     2 | pg_dump → S3 + cron + ретенция, тест восстановления + runbook     |
| 9.8 CI/CD               |     3 | Actions deploy, миграции+секреты, fallback+rollback               |

## Ключевые архитектурные решения

### Архитектура развёртывания

4 контейнера. Caddy — единственная точка входа (80/443), терминирует HTTPS. Две docker-сети: frontend (caddy↔web, caddy↔bot webhook), backend (web↔bot internal notify, ↔postgres). postgres и internal notify НЕ публичны.

### Webhook vs internal (разделение из Phase 8)

bot держит два listener: webhook :8443 (публичный через Caddy, от Telegram, secret_token защита) и internal notify :3001 (приватный, от web, secret + внутренняя сеть). Webhook/polling переключается env (BOT_MODE), internal notify всегда (web→bot уведомления и в dev, и в prod).

### Двойная защита webhook

Секретный путь Caddy (/tg/webhook/<secret>) скрывает URL + Telegram secret_token заголовок (grammY проверяет). Defense in depth.

### Caddy auto-HTTPS

Let's Encrypt zero-config. ВАЖНО: НЕ ставить X-Frame-Options DENY (Mini App в Telegram webview — иначе белый экран). caddy_data volume (не упереться в LE rate limit).

### Бэкапы с тестом восстановления

pg_dump (gzip) → Selectel Object Storage (S3, отдельно от VPS), cron 04:00 МСК, ретенция 21 день. Тест восстановления обязателен (бэкап без проверки = нет бэкапа). Disaster recovery runbook (БД + полная потеря VPS, RPO 24ч / RTO 1-2ч).

### CI/CD с fallback

Actions: test → build (web+bot) → ghcr push → SSH (pull → migrate → up → prune). Fallback build-on-VPS если ghcr недоступен из РФ (реальный риск). Миграции отдельным шагом ДО up (новый код ждёт новую схему). sha-теги для rollback. Секреты GitHub Secrets → .env (600).

## Важное: email отложен (решение 14)

Email-провайдер (Unisender Go) НЕ подключаем в Phase 9. Последствия:

- Telegram Mini App auth работает полностью (основной путь)
- Браузерный email-логин (3.4.2) в production НЕ шлёт коды (нет провайдера)
- Для MVP приемлемо (пользователи через Telegram)
- Email — отдельная задача позже (Phase 10/15)

## Риски, отмеченные в задачах

- **ghcr из РФ** — может быть недоступен с VPS. Fallback build-on-VPS (9.8.3), опц российский registry.
- **Hardening порядок** — не отключать root SSH до проверки deploy-юзера (локаут).
- **X-Frame-Options** — не DENY (ломает Mini App).
- **Миграции** — forward-compatible (упрощает rollback).

## Метрики сессии

- Phase 9: 8 эпиков, 16 задач, 1744 строки
- Все с frontmatter + 6 секций
- Инфраструктурная фаза (DevOps + Back роли)

## Что дальше

### Phase 9 завершена (планирование)

После реализации — MVP в production 24/7. Реальный запуск в группе возможен.

### Следующая фаза — Phase 10 (Private Beta) — ГЕЙТ

Закрытый запуск в реальной группе, сбор обратной связи, стабилизация. Это гейт перед расширением. Совпадает с Треком B (реальная эксплуатация).

### Потом — Phase 7 (Event Credits)

Монетизация, БЛОКИРУЕТСЯ Треком A (юридическое). К этому моменту Трек A должен быть готов.

### Параллельные треки (НЕ двигались 9 сессий — КРИТИЧНО!)

- **Трек A (юридическое):** регистрация ИП/НПД. Блокирует Phase 7, 12-13. Phase 9-10 не блокирует, но монетизация близко — пора оформлять.
- **Трек B (реальная группа):** Phase 10 = по сути формализация Трека B. Можно начать раньше (прототип/ранний MVP в группе).
