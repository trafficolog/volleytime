---
id: '15.1.2'
phase: '15'
epic: '15.1'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.1.1'
  - '9.5.2'
estimated_hours: '1-2'
tags:
  - pg-boss
  - bot
  - worker
---

# Task 15.1.2: Запуск worker в bot + регистрация обработчиков + graceful stop

## Цель

Запустить pg-boss worker в bot-процессе (рядом с webhook/internal listeners). Регистрация всех обработчиков при старте. Graceful shutdown.

## Контекст

Решение 2: worker в bot-процессе. Bot уже поднимает webhook (:8443) и internal notify (:3001) (Phase 9.5.2). Добавляем pg-boss worker — третий компонент bot-процесса.

## Что должно быть сделано

1. **Реестр обработчиков `apps/bot/src/jobs/index.ts`:**

   ```ts
   import { reminder24hJob, reminder2hJob } from './handlers/reminders' // 15.3
   import { autoFinishJob } from './handlers/auto-finish' // 15.4
   import { pendingTtlJob } from './handlers/pending-ttl' // 15.6
   import { waitlistOfferTtlJob } from './handlers/waitlist-offer' // 15.5
   import { notifyDeliverJob } from './handlers/notify-deliver' // 15.7

   const allJobs = [
     reminder24hJob,
     reminder2hJob,
     autoFinishJob,
     pendingTtlJob,
     waitlistOfferTtlJob,
     notifyDeliverJob,
   ]

   export async function registerAllJobs() {
     for (const job of allJobs) {
       await job.register()
     }
     console.log(`[jobs] registered ${allJobs.length} handlers`)
   }
   ```

   (обработчики создаются в соответствующих эпиках; здесь — каркас реестра)

2. **Запуск в bot index (расширение 9.5.2):**

   ```ts
   import { getBoss, stopBoss } from './jobs/boss'
   import { registerAllJobs } from './jobs'

   async function main() {
     // ... webhook / polling (9.5) ...
     // ... internal notify (9.5.2) ...

     // pg-boss worker
     await getBoss() // start
     await registerAllJobs() // обработчики

     console.log('[bot] started: webhook/polling + internal notify + job worker')
   }

   // graceful shutdown
   process.on('SIGTERM', shutdown)
   process.on('SIGINT', shutdown)
   async function shutdown() {
     console.log('[bot] shutting down...')
     await stopBoss() // дождаться текущих задач
     // ... остановить серверы ...
     process.exit(0)
   }
   ```

3. **Health:** опционально — pg-boss статус в /health бота (или web /health уже покрывает БД). Worker жив = bot жив.

4. **Конфиг:** worker concurrency (pg-boss teamSize) — дефолт ок для нашего объёма.

5. **Проверка:**
   - bot стартует, pg-boss подключается, обработчики зарегистрированы
   - Тестовая задача (enqueue) обрабатывается
   - SIGTERM → graceful stop (текущие задачи завершаются)

## Критерии приёмки

- ✅ pg-boss worker стартует в bot-процессе
- ✅ registerAllJobs регистрирует все обработчики
- ✅ Worker рядом с webhook + internal notify (один процесс)
- ✅ Graceful shutdown (SIGTERM/SIGINT → stopBoss)
- ✅ Тестовая задача обрабатывается
- ✅ Bot не падает если pg-boss временно недоступен (лог)

## Подсказки

- **Один процесс, три роли:** bot теперь webhook + internal notify + job worker. Все в одном Node-процессе (Phase 9 deploy — один bot контейнер).
- **Graceful stop важен** — при деплое (рестарт) текущие задачи должны завершиться, не оборваться. stopBoss ждёт.
- **Реестр-каркас сейчас, обработчики позже** — этот файл импортирует обработчики из 15.3-15.7. На момент 15.1.2 можно заглушки/пустой массив, наполнить по мере эпиков.
- **Concurrency** — pg-boss teamSize дефолт (1-10) ок. Наш объём мал (десятки задач/день).

## Не делать

- ❌ Не делать отдельный worker-контейнер
- ❌ Не ронять bot при недоступности pg-boss (graceful)
- ❌ Не обрывать задачи при shutdown (graceful stop)
