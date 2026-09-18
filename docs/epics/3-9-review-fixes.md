---
id: '3.9'
phase: '3'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: 'Фиксы находок ревью Phase 3 (4 P0, 6 P1, 1 P2 + визуал).'
estimated_hours: '18-26'
depends_on: []
---

# Epic 3.9: Исправления по ревью v0.1.0 — Foundation

**Цель.** Закрыть все находки ревью реализации Phase 3: сломанный вход (email-OTP и Telegram), подделка Telegram-входа, неустанавливаемый монорепо, непроверяемый web-слой и рассинхрон документации.

## Контекст

Ревью `main @ 3882bc1 (v0.1.0)` (см. `docs/operations/reviews/2026-09-16-v0.1.0-review.md`) показало, что фундамент аккуратный, но оба сценария входа не работают, а Telegram-вход подделывается подписью пустым токеном. Большинство P0 последующих фаз сводятся к двум корневым причинам, которые закрываются здесь:

1. **Переменные окружения** — Nuxt читает только `NUXT_*`; нет fail-fast (задача 3.9.2).
2. **Схема better-auth и две системы сессий** (задачи 3.9.3, 3.9.4).

Эпик — первый в порядке исправлений: без него не работают фиксы 4.9 / 8.8 / 9.9.

## Definition of Done

- `pnpm install --frozen-lockfile` проходит без ошибок
- `pnpm dev` читает корневой `.env` (web и bot)
- Email-OTP вход проходит полный цикл (интеграционный тест)
- Telegram-вход создаёт **better-auth** сессию; подпись пустым токеном → 401; без токена приложение не стартует в production
- Одна система сессий: `useAuth` видит Telegram-сессию
- Web проверяется `vue-tsc`, ESLint линтит `.vue`, vitest запускает тесты `apps/web`
- Бот: `bot.catch`, graceful shutdown, ответ на прочие сообщения
- Эндпоинт привязки Telegram к email-аккаунту с маппингом ошибок в 409
- `truncateAll` доступен только из `@volley-time/db/test-utils`
- `validateInitData`: окно 1 ч, запрет даты из будущего, zod-схема `user`
- Есть `test:integration`, `db:rollback`, `scripts/setup.sh`; статусы карточек соответствуют факту
- Главная с CTA, логин с «Изменить email / Отправить повторно», `lang="ru"` и `<title>`, дизайн-токены Claude Design перенесены

## Задачи

| ID                                                       | Приоритет | Задача                                                                                        | Часов |
| -------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- | ----: |
| [3.9.1](../tasks/3-9-1-pnpm-allow-builds.md)             | P0        | pnpm install --frozen-lockfile падает (allowBuilds плейсхолдер)                               |   0.5 |
| [3.9.2](../tasks/3-9-2-runtime-config-env.md)            | P0        | Env → runtimeConfig: явный маппинг и fail-fast; validateInitData отвергает пустой токен       |   2-3 |
| [3.9.3](../tasks/3-9-3-better-auth-schema.md)            | P0        | Схема БД, совместимая с better-auth: verifications, sessions.updatedAt, accounts, числовые ID |   3-4 |
| [3.9.4](../tasks/3-9-4-single-session.md)                | P0        | Единая система сессий: Telegram-вход создаёт сессию better-auth                               |   3-4 |
| [3.9.5](../tasks/3-9-5-dotenv-root.md)                   | P1        | Корневой .env читается web и ботом в dev                                                      | 0.5-1 |
| [3.9.6](../tasks/3-9-6-web-quality-gates.md)             | P1        | Web-слой под проверками: vue-tsc, eslint-plugin-vue, vitest для apps/web                      |   3-4 |
| [3.9.7](../tasks/3-9-7-bot-resilience.md)                | P1        | Бот: bot.catch, graceful shutdown, ответ на прочие сообщения                                  |     1 |
| [3.9.8](../tasks/3-9-8-link-telegram-endpoint.md)        | P1        | Эндпоинт привязки Telegram к аккаунту (/api/auth/link/telegram) с 409                         |   1-2 |
| [3.9.9](../tasks/3-9-9-db-test-utils-entry.md)           | P1        | truncateAll только из @volley-time/db/test-utils                                              |   0.5 |
| [3.9.10](../tasks/3-9-10-validate-initdata-hardening.md) | P1        | validateInitData: окно 1 ч, дата из будущего, zod-схема user                                  |     1 |
| [3.9.11](../tasks/3-9-11-scripts-docs-sync.md)           | P2        | test:integration, db:rollback, setup.sh, мёртвый app.vue, версии vitest, статусы документации |   2-3 |
| [3.9.12](../tasks/3-9-12-home-login-ui.md)               | P2        | UI Phase 3: главная с CTA, логин «Изменить email / Отправить повторно», lang/title            |     2 |
| [3.9.13](../tasks/3-9-13-design-tokens.md)               | P2        | Дизайн-токены и базовые компоненты из Claude Design (архив 2026-09-16)                        |   3-4 |

## Не делать

- ❌ Не менять стек (better-auth остаётся; Lucia не рассматриваем)
- ❌ Не добавлять новые провайдеры входа
- ❌ Не переписывать сервисы других фаз — только то, что требуют находки Phase 3

## Открытые вопросы

- Хеширование токенов сессий: better-auth 1.7 не поддерживает хранение хеша session token. Решение в 3.9.4 — cookie подписан HMAC, OTP хранится хешем; хеш session token — accepted risk (см. ADR в карточке).
