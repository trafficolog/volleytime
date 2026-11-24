---
id: '30.4.3'
phase: '30'
epic: '30.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-24
status_note: 'Перепланирование 19.0.5 (референс 2026-11-24). Релиз назначает владелец.'
ref_id: 'R-09'
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, FE]
depends_on: ['22.1.2', '23.1.2']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-09-impersonation-flags.md'
  screens: []
tags: [reference-v3]
---

# Task 30.4.3: Root Admin: вход в организацию и функции по организациям

## Цель

Root входит в организацию только с подтверждением и следом в журнале; волны гипотез включаются по организациям.

## Контекст

- Спецификация референса: [R-09 · Вход в организацию и функции по организациям](../design/reference-v3/specs/04-root-admin/R-09-impersonation-flags.md); обновление референса — [отчёт 2026-11-24](../design/2026-11-24-reference-v3-update.md).
- Макет: 4b Root Admin → Организации → ··· → Войти как владелец / Функции организации.
- **Как есть (main `69a5595`):** входа root в организацию и функций по организациям нет; root не имеет членства (`permissions-v3`: «Root не обходит tenant»).
- **Дельта до референса:** всё, что в «Что должно быть сделано»; работающее не переписывается.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

**Объём** (по спецификации)

- Подтверждение входа: сессия 30 мин, деньги только для чтения
- Жёлтый баннер на всех экранах сессии с кнопкой «Завершить»
- Запись `admin.impersonate.start/stop` в журнал
- Функции организации: 8 флагов гипотез, изменения в журнал

**Данные и API** (по спецификации; точные маршруты и имена — в контракте)

- POST /admin/orgs/{id}/impersonate
- PATCH /admin/orgs/{id}/features

## Критерии приёмки

- ✅ В сессии нельзя изменить кассу, баланс событий и выплаты
- ✅ Сессия закрывается сама через 30 минут
- ✅ IDOR- и ролевые тесты на каждый новый эндпоинт
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` (обязательны тесты граничных случаев) без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, токены, доменная логика.
- Сессия входа: 30 минут, деньги только чтение, жёлтый баннер, журнал `admin.impersonate.start/stop`; права — Owner и Admin (R-15).

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
- ❌ Не давать сессии входа права на кассу, баланс и выплаты
