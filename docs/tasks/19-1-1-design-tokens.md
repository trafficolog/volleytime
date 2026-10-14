---
id: '19.1.1'
phase: '19'
epic: '19.1'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-14
status_note: 'Токены и SVG/PNG-ассеты v3: PR #101 + #103, ревью merge; D1 и D2 исправлены (PR #112), повторная проверка пройдена: docs/operations/qa/2026-10-13-wave1-visual.md.'
ref_id: 'P-15'
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-15-design-tokens.md'
  screens: ['1-brand', '8-logo']
tags: [reference-v3]
---

# Task 19.1.1: Дизайн-токены и ассеты v3 (`P-15`)

## Цель

Перенести визуальную систему Bento Bold в код.

## Контекст

- Спецификация референса: [P-15 · Дизайн-токены и ассеты](../design/reference-v3/specs/01-platform/P-15-design-tokens.md); макет: 1 Brand and System; 8 Логотип — комплект.
- **Как есть (main `e68acf2`):** Токены v2 в `apps/web/app/assets/css/tokens.css` (задачи 3.11.1, 3.11.9, 3.11.11–13), логотип PNG, локальные шрифты Oswald/Golos.
- **Дельта до референса:** В v3: шкала размеров `--fs-2xs…--fs-7xl`, радиусы `--r-xs/--r-sm/--r-pill`, отступы `--s-10/--s-12`, токены текста на hero (`--vt-on-hero*`), оверлеи и тени (`--vt-scrim`, `--vt-sheet-shadow`, `--vt-pop-shadow`, `--vt-modal-shadow`, `--vt-toast-*`), новый `--vt-shadow-accent` (нейтральный вместо синего), SVG-знак «Галочка-подача» и комплект `assets/logo/*.svg` (favicon, apple-touch, on-blue/on-orange).
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. CSS-переменные цветов, радиусов, теней, шрифтов из styles.css
2. SVG-иконки
3. Логотип и фавиконы из assets/logo
4. Правила серых контролов на сером фоне
5. Заменить PNG-логотип на SVG-комплект из `handoff/assets/logo/`
6. Перевести литеральные размеры шрифтов на `--fs-*`
7. Данные и API: Пакет токенов.
8. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Цвета и отступы в приложениях берутся только из токенов
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [1-brand](../design/reference-v3/screenshots/1-brand), [8-logo](../design/reference-v3/screenshots/8-logo) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/brand.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`, `docs/design/reference-v3/handoff/styles.css`, `docs/design/reference-v3/handoff/brand-ideas.jsx`, `docs/design/reference-v3/handoff/assets/logo/`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Haiku-задача: только вёрстка, тексты и переименования. Если нужна бизнес-логика — остановиться и эскалировать оркестратору.

## Не делать

- ❌ Не менять компоненты и разметку экранов — только токены и ассеты
- ❌ Не трогать бизнес-логику
- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
