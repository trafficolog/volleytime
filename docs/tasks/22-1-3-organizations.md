---
id: '22.1.3'
phase: '22'
epic: '22.1'
status: done
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-11-19
status_note: 'Закрыта: PR #299 смёржен в main (merge cc96f5be), независимое ревью `claude-sonnet-5-5` — вердикт merge, CI зелёный на ea4ebb18. Follow-ups и открытые решения владельца — в секции «Follow-ups» ниже. Сделано: GET /api/platform/organizations (список), GET /api/platform/organizations/{id} (карточка), POST /api/platform/organizations (ручное создание); все за requireRootAdmin (401/403 forbidden.root_only, no-store), сервис platformOrganizationsService повторно проверяет root по базе. Страницы /root/organizations, /root/organizations/new, /root/organizations/{id}, пункт «Организации» в сайдбаре. Список: фишки Все / Активные / В риске / Заблокированы со счётчиками, панель «Фильтры» по кнопке (баланс заканчивается, неактивны больше 7 дней, сортировка по событиям), поиск по названию, коду, городу и владельцу, страницы по 50; все фильтры в URL (?status=&lowBalance=1&inactive=1&sort=events&q=&page=). Карточка: профиль, модули группы (subscriptions, public_page, seo_index), показатели (баланс событий, игроки, события за 30 дней, активность), журнал группы за 7 дней без секретов, последние операции баланса. Создание: владелец ищется по email или @telegram-имени среди существующих пользователей, группа, членство owner, демо-квота баланса и записи журнала `organization.created` и `member.added` с автором root пишутся в одной транзакции (вызов organizationService.createForOwner). Без миграций и lockfile. Не вошло (нет данных в модели или чужие карточки): колонка и фильтры «План» (beta/demo) и стартовые credits формы (в схеме нет плана организации; демо-квота начисляется по умолчанию), блокировка организации, «Войти как owner», выдача баланса (22.2.2), feature flags, вкладки Члены / События / Финансы / Аудит карточки, CSV и глобальный поиск шапки, приглашение несуществующего владельца. Визуальная сверка с 4b-root-admin/02–04 выполнена вручную (1440x900 и 375x812, локальная БД с демо-сидом), см. PR.'
ref_id: 'R-01'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['19.2.1', '22.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-01-organizations.md'
  screens:
    ['4b-root-admin/02-screen.png', '4b-root-admin/03-screen.png', '4b-root-admin/04-screen.png']
tags: [reference-v3]
---

# Task 22.1.3: Организации платформы (`R-01`)

## Цель

Управление организациями платформы.

## Контекст

- Спецификация референса: [R-01 · Организации](../design/reference-v3/specs/04-root-admin/R-01-organizations.md); макет: 7 Root Admin → Организации.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Список с фильтрами в URL, карточка, ручное создание, модули организации.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Список
2. Фильтры по кнопке
3. Ручное создание
4. Карточка
5. Сверить экраны с референсом и приложить отчёт к PR. По решению владельца [D-16](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-16) (2026-11-19) пункт выполняется ручной проверкой (десктоп 1440x900 и мобильный 375x812, отчёт в теле PR), а не харнессом [19.0.2](19-0-2-visual-reference-harness.md): в нём нет роли root.

## Критерии приёмки

- ✅ Фильтры сохраняются в URL
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/02-screen.png](../design/reference-v3/screenshots/4b-root-admin/02-screen.png), [4b-root-admin/03-screen.png](../design/reference-v3/screenshots/4b-root-admin/03-screen.png), [4b-root-admin/04-screen.png](../design/reference-v3/screenshots/4b-root-admin/04-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Follow-ups

Замечания, не блокировавшие merge PR #299. Они не входят в критерии приёмки 22.1.3 и берутся отдельными задачами.

- Фишки «Активные» и «В риске» пересекаются (активная организация с низким балансом попадает в обе): решение владельца, как их разделить.
- Фильтры, сортировка и страницы списка организаций считаются в памяти: когда организаций станет тысячи, перенести в SQL (как в списке пользователей 22.1.4).
- Поиск владельца при ручном создании по `lower(email)` и `lower(telegram_username)` не использует индекс: добавить функциональные индексы по `lower(...)`, когда пользователей станет много.
- Решения владельца, ожидающие ответа: план организации и стартовые credits (нужна миграция), приглашение несуществующего владельца, блокировка организации, «Войти как owner», вкладки карточки (Члены / События / Финансы / Аудит), CSV.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
