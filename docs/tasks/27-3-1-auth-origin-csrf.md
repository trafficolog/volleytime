---
id: '27.3.1'
phase: '27'
epic: '27.3'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (AUTH-01). Релиз назначает владелец.'
ref_id: ''
review_ref: 'AUTH-01'
priority: P1
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, SECURITY]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '6-12'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, auth, csrf]
---

# Task 27.3.1: Явные trustedOrigins, атрибуты cookie и проверка Origin для мутирующих запросов

## Цель

Сессионная cookie и мутирующие API защищены от межсайтовых запросов явной конфигурацией, а не значениями по умолчанию.

## Контекст

- Замечание `AUTH-01` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `packages/auth/src/config.ts` не задаёт `trustedOrigins`, атрибуты cookie и `rateLimit`; собственные `POST/PATCH/DELETE /api/**` проверяют только сессию, защита от CSRF держится на SameSite по умолчанию.
- Одна cookie для лендинга, кабинета и Mini App; Mini App работает во фрейме Telegram (Desktop, Android, iOS, Telegram Web) — SameSite должен это допускать.
- Сначала проверить фактические значения по умолчанию установленной версии better-auth и записать их в PR.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Зафиксировать текущие атрибуты cookie (`SameSite`, `Secure`, `HttpOnly`, `Path`, домен) на production-сборке локально.
2. Задать в конфигурации явно: `trustedOrigins` из `PUBLIC_URL`, атрибуты cookie, совместимые с фреймом Telegram (обосновать выбор).
3. Серверный middleware: для не-GET `/api/**` (кроме webhook и внутренних с секретом) требовать `Origin` из списка или `Sec-Fetch-Site: same-origin`; иначе 403.
4. Тесты: чужой origin → 403; без Origin и с `Sec-Fetch-Site: cross-site` → 403; свой origin → 200; внутренние маршруты не затронуты.
5. Ручная проверка входа и записи в Telegram Desktop и Android — в релизной QA (записать в карточке релиза).

## Критерии приёмки

- ✅ Атрибуты cookie и trustedOrigins заданы в конфигурации и покрыты тестом
- ✅ Мутирующий запрос с чужого origin отклоняется 403 (тесты на каждый метод)
- ✅ Вход и запись в Mini App работают (локальная проверка; Telegram — в релизной QA)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не вводить CSRF-токены в формы без необходимости
- ❌ Не менять срок сессии
