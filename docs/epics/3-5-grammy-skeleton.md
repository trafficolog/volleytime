---
id: '3.5'
phase: '3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'grammY bot с базовым /start handler. Без бизнес-логики.'
estimated_hours: '3-4'
depends_on: ['3.3']
---

# Epic 3.5: grammY bot скелет

**Цель.** Создать `apps/bot` (grammY) с базовым `/start` handler. Бот отвечает кнопкой «Открыть приложение» с deeplink на Mini App.

## Контекст

grammY — TypeScript-first библиотека для Telegram Bot API. В Phase 3 бот делает **минимум**:

- Принимает `/start`
- Если есть deeplink-параметр (`/start org_xyz`) — сохраняет в стейте для дальнейшей обработки (но обрабатывает в Phase 4)
- Отвечает inline-кнопкой «Открыть Volley Time» с ссылкой на Mini App с правильным WebApp URL

В Phase 3 бот работает в **long-polling** режиме (для dev). Webhook — Phase 9.

## Definition of Done

- Создан `apps/bot`
- grammY установлен
- Bot стартует через `pnpm dev:bot` (или как часть `pnpm dev`)
- `/start` отвечает welcome-сообщением + inline-кнопкой «Открыть Volley Time»
- Кнопка открывает Mini App (`https://t.me/volleytime_bot/app?startapp=...`)
- Структура файлов:
  ```
  apps/bot/src/
  ├── index.ts          # entry point
  ├── client.ts         # Bot instance
  ├── handlers/
  │   └── start.ts
  └── middlewares/
      └── logging.ts
  ```
- Конфиг через env (`TELEGRAM_BOT_TOKEN`)
- Логирование (pino или встроенное)

## Задачи

| ID                                       | Задача                           | Часов |
| ---------------------------------------- | -------------------------------- | ----: |
| [3.5.1](../tasks/3-5-1-grammy-init.md)   | grammY init + Bot client         |   1-2 |
| [3.5.2](../tasks/3-5-2-start-handler.md) | /start handler с Mini App button |   1-2 |

## Не делать

- ❌ Не парсить deeplink-параметры детально — это Phase 4 (invite flow)
- ❌ Не отправлять уведомления — это Phase 8
- ❌ Не делать FSM / scenes — пока не нужно
- ❌ Не подключать webhook mode — Phase 9
- ❌ Не интегрировать с БД из бота напрямую — это сделается через API в Phase 4+

## Открытые вопросы

- Где разворачивать связку bot ↔ web? **Решение:** бот делает HTTP-запросы к `apps/web` API. То есть бот — это **отдельный процесс**, общается с web через REST. Это упрощает scaling.
- Что если bot token не задан в `.env`? **Решение:** бот логирует warning «Bot token not set, bot disabled» и завершает работу graceful. Web-приложение продолжает работать.
