---
id: '27.3.3'
phase: '27'
epic: '27.3'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (AUTH-03). Релиз назначает владелец.'
ref_id: ''
review_ref: 'AUTH-03'
priority: P2
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, SECURITY]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, auth, telegram]
---

# Task 27.3.3: Защита от повторного использования initData

## Цель

Перехваченный initData нельзя использовать повторно для входа или привязки Telegram в пределах окна действия.

## Контекст

- Замечание `AUTH-03` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `packages/auth/src/telegram/validate.ts` — окно 1 час (настраивается), допуск часов 60 с, защиты от повтора нет; `/sign-in/telegram` и `/link/telegram` принимают один и тот же initData многократно.
- Mini App повторно входит при открытии; если пользователь держит Mini App открытым дольше окна, вход уже обновлён сессией — проверить, нет ли повторного входа тем же initData в клиенте.
- Хранение использованных подписей может потребовать таблицы: схему и контракт задаёт `claude-opus-5-5` (правило 3 ORCHESTRATION), миграция — одна в работе одновременно.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Проверить клиент: сколько раз отправляется один initData за открытие Mini App.
2. Выбрать механизм с ревьюером: сокращение окна для входа (например, 10 мин) плюс таблица использованных `hash` с очисткой по сроку; для `link/telegram` — одноразовость обязательна.
3. Реализовать, тесты: повтор того же initData → 401; новый initData → 200; конкурентные запросы с одним initData — успешен один.
4. Обновить переменные окружения и runbook, если окно меняется.

## Критерии приёмки

- ✅ Повторный вход и привязка тем же initData отклоняются (тесты, включая гонку)
- ✅ Обычный вход из Mini App не сломан
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять алгоритм проверки подписи
- ❌ Не хранить initData целиком — только hash
