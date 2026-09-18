---
id: '3.4'
phase: '3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Nuxt 4 app скелет с auth UI и Mini App route.'
estimated_hours: '5-6'
depends_on: ['3.3']
---

# Epic 3.4: Nuxt 4 web app

**Цель.** Создать `apps/web` (Nuxt 4) с базовым layout, страницами входа/регистрации через email-code, Mini App route с auth через initData.

## Контекст

Nuxt 4 — основной фронтенд платформы. Один проект, два контекста:

- Обычный веб (`/`, `/login`, etc.) — для админов и desktop
- Mini App (`/m/*`) — для Telegram WebApp

В Phase 3 делаем **минимум**: стартовая страница, страница входа, заглушка Mini App. Никакой бизнес-логики.

## Definition of Done

- Создан `apps/web` через `pnpm create nuxt@latest` (Nuxt 4)
- Tailwind CSS установлен и работает
- Базовый layout (`layouts/default.vue`) с минимальным header
- Стартовая страница `pages/index.vue` со ссылками «Войти», «Я из Telegram»
- Страница `pages/login.vue`: форма email → ввод кода → результат
- Страница `pages/m/index.vue` — Mini App entrypoint, авторизуется через initData
- better-auth integrated через Nuxt server routes (`server/api/auth/*`)
- Composable `useAuth()` для проверки текущего пользователя
- Middleware `auth` для защищённых страниц
- `pnpm dev` поднимает Nuxt на `localhost:3000`

## Задачи

| ID                                            | Задача                                   | Часов |
| --------------------------------------------- | ---------------------------------------- | ----: |
| [3.4.1](../tasks/3-4-1-nuxt-init.md)          | Nuxt 4 init + Tailwind + layout          |     2 |
| [3.4.2](../tasks/3-4-2-auth-pages-web.md)     | Веб-страницы auth (index, login, verify) |     2 |
| [3.4.3](../tasks/3-4-3-miniapp-entrypoint.md) | Mini App entrypoint с initData auth      |   1-2 |

## Не делать

- ❌ Не создавать страницы для Organization, Event, Booking — это Phase 4-5
- ❌ Не подключать UI-библиотеки (shadcn-vue, nuxt-ui) — Tailwind hand-rolled достаточно для MVP layout
- ❌ Не делать i18n (один язык — русский)
- ❌ Не делать темизацию (только light theme)
- ❌ Не оптимизировать SEO (Mini App вообще no-index)
- ❌ Не интегрировать с Telegram Theme API детально — это Phase 8

## Открытые вопросы

- Использовать `@nuxt/ui` или нет? **Решение:** нет, для MVP базовый Tailwind. Это даёт большую свободу + меньше веса.
- SSR или SPA для Mini App? **Решение:** Mini App работает как SPA (через ssr: false для `/m/*` routes) — Telegram WebApp требует быстрый JS-rendering. Веб — SSR (стандарт Nuxt).
