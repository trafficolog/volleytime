---
id: '20.4.3'
phase: '20'
epic: '20.4'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-14
status_note: 'PR #122 merged as 4f80cdc, ревью standard: merge после одного раунда исправлений, CI зелёный на 2d1fd61; отклонение по доступности от handoff README:161 (ссылки с aria-current вместо role=radio) зафиксировано в карточке; трёхшаговый мастер создания группы вынесен в карточку v0.3.0 21.1.7.'
ref_id: 'M-04'
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.2.1']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-04-group-switcher.md'
  screens: ['3-miniapp-player/01-screen.png', '3-miniapp-organizer/01-screen.png']
tags: [reference-v3]
---

# Task 20.4.3: Переключатель групп (`M-04`)

## Цель

Переход между группами игрока.

## Контекст

- Спецификация референса: [M-04 · Переключатель групп](../design/reference-v3/specs/02-mini-app/M-04-group-switcher.md); макет: 3 Mini App → тап по названию группы.
- **Как есть (main `e68acf2`):** Список групп `/m/orgs`, создание `/m/orgs/create`.
- **Дельта до референса:** Шторка «Мои группы» из шапки, логотип или монограмма (цвет по хэшу), выбранная — залитый flame-круг с галочкой (`role="radio"`), «Создать свою группу»; в Mini App везде «группа».
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Шторка «Мои группы»
2. Логотип группы или заглушка с инициалами
3. Выбранная группа — залитый круг с галочкой
4. «Создать свою группу»
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Переключение меняет данные всех вкладок
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты триггера в шапках главных экранов: [3-miniapp-player/01-screen.png](../design/reference-v3/screenshots/3-miniapp-player/01-screen.png) и [3-miniapp-organizer/01-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/01-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Самой шторки в наборе скриншотов нет: состав и поведение сверяются с `handoff/screens-player.jsx`, строки 9–18 (`switchOrg`). [3-miniapp-player/14-screen.png](../design/reference-v3/screenshots/3-miniapp-player/14-screen.png) — мастер создания группы «Своя группа · Шаг 1 из 3», относится к другой задаче; к этой карточке не привязан.
- Принятое отклонение от `handoff/README.md` (строка 161, «Группы»): текущая группа в шторке — `aria-current` на ссылке, а не `role="radio"`. Причина: выбор группы переходит по ссылке, поэтому радиогруппа с клавиатурной моделью выбора не соответствует поведению; визуально сохранены залитый flame-круг с галочкой. Не-доступные группы (ожидание, приостановлена) не являются ссылками (`aria-disabled`).
- Текст «Вступить по ссылке» и иконка `link` — по прототипу; ведёт на `/m/orgs`, где открывается ввод приглашения (маршрута «onboard» в приложении нет).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Haiku-задача: только вёрстка, тексты и переименования. Если нужна бизнес-логика — остановиться и эскалировать оркестратору.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
