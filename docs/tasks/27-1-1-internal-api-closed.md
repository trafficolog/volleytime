---
id: '27.1.1'
phase: '27'
epic: '27.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (INF-01). Релиз назначает владелец.'
ref_id: ''
review_ref: 'INF-01'
priority: P1
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [DEVOPS, BACK]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, infra, bot]
---

# Task 27.1.1: Закрыть внутренний API от внешнего доступа и разделить служебные секреты

## Цель

Маршруты `/api/internal/**` отвечают только изнутри сети compose; снаружи остаётся один служебный маршрут для smoke со своим секретом.

## Контекст

- Замечание `INF-01` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `Caddyfile` проксирует на `web:3000` всё, кроме пути webhook; `apps/web/server/api/internal/**` (bot/*, invites preview, smoke/cleanup) защищены одним заголовком `x-internal-secret` (`apps/web/server/utils/internal-auth.ts`); лимита запросов на этих путях нет.
- Бот вызывает внутренний API от имени любого Telegram-пользователя, поэтому утечка секрета равна действиям от его имени.
- `smoke/cleanup` вызывается с GitHub runner через публичный домен (`.github/workflows/deploy.yml`, `scripts/smoke*`): этот путь должен остаться рабочим.
- Изменение выкладки проверяется по [deploy runbook](../operations/runbooks/deploy.md); в production попадает только через релизную задачу и Promote с подтверждением владельца.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Найти все вызовы внутреннего API (бот, smoke, скрипты) и адреса, по которым они ходят; записать таблицу в PR.
2. Бот ходит в web по внутреннему адресу сети compose (`http://web:3000`), не через публичный домен; настройка через переменную окружения.
3. Caddy: `/api/internal/*` отвечает 404 снаружи, кроме `/api/internal/smoke/*`.
4. Разделить секреты: бот → web, web → бот (`/internal/notify`), smoke; каждый маршрут принимает только свой. Обновить `.env.example`, генерацию env в deploy и runbook.
5. Тесты (RED→GREEN): маршрут бота отклоняет секрет smoke и наоборот; конфигурационный тест Caddyfile (или smoke-проверка) на 404 для внешнего `/api/internal/bot/*`.
6. Порядок выкладки без простоя: web принимает старый и новый секрет одну выкладку, затем старый удаляется; описать в runbook.

## Критерии приёмки

- ✅ Снаружи `/api/internal/bot/*` и `/api/internal/invites/*` отвечают 404; бот и smoke работают
- ✅ Каждый служебный маршрут принимает только свой секрет (тесты)
- ✅ Runbook и `.env.example` описывают новые переменные; значения нигде не напечатаны
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять контракт и поведение маршрутов бота
- ❌ Не убирать проверку секрета у внутренних маршрутов даже после закрытия в Caddy
- ❌ Не выкладывать без подтверждения владельца
