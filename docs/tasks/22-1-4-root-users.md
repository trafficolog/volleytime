---
id: '22.1.4'
phase: '22'
epic: '22.1'
status: in_progress
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-11-19
status_note: 'Реализация в PR (ветка trafficolog/feat/22-1-4-root-users), ждёт независимого ревью и CI. Сделано: GET /api/platform/users (список), GET /api/platform/users/{id} (карточка), POST /api/platform/users/{id}/block и /unblock; все за requireRootAdmin (401/403 forbidden.root_only, no-store), сервис platformUsersService повторно проверяет root по базе. Страницы /root/users и /root/users/{id}, пункт «Пользователи» в сайдбаре. Список: четыре плитки (всего, Telegram, email, активны 7д), фишки Все / Активные / Заблокированные со счётчиками, поиск по имени, email, @telegram и usr_N, страницы по 50 (фильтрация, сортировка и пагинация в SQL), фильтры в URL (?status=&q=&page=). Карточка: профиль, группы и роли, журнал блокировок, кнопки «Заблокировать» (с подтверждением) и «Разблокировать». Блокировка — существующее поле users.is_active = false (миграции нет): в одной транзакции флаг, закрытие всех сессий пользователя и запись журнала user.blocked / user.unblocked с автором root (платформенный журнал 22.1.2 показывает её без фильтра по разделу). Себя и другого root заблокировать нельзя (422 platform.user_cannot_block_self / platform.user_cannot_block_root); повтор — 409 без записи в журнал. Применение: бот уже читал is_active (userByTelegramId); теперь новую сессию не выдают ни email-OTP, ни Telegram (databaseHooks.session.create.before в packages/auth, 403 user.blocked), а requireAuth проверяет флаг на каждом запросе (403 user.blocked), поэтому доступ пропадает сразу. Персональные данные: root видит имя, email и Telegram-имя; телефон, числовой Telegram id и данные сессий наружу не отдаются. Не вошло: «Экспорт» (CSV — решение владельца), меню «…» в строке списка (действия вынесены в карточку), «Связаться в Telegram», блокировка по причине, фильтр категории «Пользователи» в журнале 22.1.2. Визуальная сверка с 4b-root-admin/10 выполнена вручную (1440x900 и 375x812, локальная БД), см. PR.'
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK, SECURITY]
depends_on: ['22.1.1', '22.1.2']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: ['4b-root-admin/10-screen.png']
tags: [reference-v3]
---

# Task 22.1.4: Пользователи платформы

## Цель

Реестр пользователей платформы для поддержки (экран 10 не покрыт задачами референса).

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Новый экран.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Список и поиск
2. Карточка: группы и роли, блокировка/разблокировка с записью в журнал
3. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Каждое изменение пользователя пишется в журнал 22.1.2
- ✅ Персональные данные показываются только root
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/10-screen.png](../design/reference-v3/screenshots/4b-root-admin/10-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
