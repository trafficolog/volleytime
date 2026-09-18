# Ведение проекта в GitHub

> Как перенести структуру фазы→эпики→задачи в GitHub для управления релизами.
> Модель: **Milestone = релиз**, **Issue = задача**, **Labels = фаза/тип/приоритет**, **Project board = kanban**.

## 1. Milestones (релизы)

Создать milestone на каждый релиз ([RELEASES.md](./RELEASES.md)):

| Milestone                   | Due (ориентир)   |   Задач |
| --------------------------- | ---------------- | ------: |
| `v0.1.0 — MVP: One Company` | по плану         |     139 |
| `v0.2.0 — Automation`       | после MVP        |      16 |
| `v0.3.0 — Beta`             | после R1         |      11 |
| `v1.0.0 — Monetization`     | после гейта беты |      15 |
| `v1.1.0+` — по факту        | —                | скелеты |

`gh` CLI:

```bash
gh api repos/:owner/:repo/milestones -f title="v0.1.0 — MVP: One Company" \
  -f description="Бот для одной компании: записи + учёт. Фазы 3,4,5,6,8,9"
```

## 2. Labels (метки)

### По фазе (для навигации)

`phase:3` … `phase:18` — из поля `phase` карточки.

### По типу работы (из поля `roles` карточки)

| Label           | Роль в карточке | Цвет       |
| --------------- | --------------- | ---------- |
| `type:backend`  | BACK (127)      | синий      |
| `type:frontend` | FE (37)         | зелёный    |
| `type:devops`   | DEVOPS (26)     | серый      |
| `type:qa`       | QA (25)         | жёлтый     |
| `type:db`       | DB (19)         | фиолетовый |
| `type:security` | SECURITY (6)    | красный    |
| `type:ops`      | OPS (4)         | коричневый |
| `type:docs`     | DOCS, PRODUCT   | светлый    |

### По статусу/приоритету

`priority:mvp` (задачи R0), `blocked` (есть незакрытые depends_on), `good-first-task` (простые старты вроде 3.1.1).

## 3. Issues (задачи)

**Каждая task-карточка → один issue.** Соответствие полей:

| Карточка                                                | GitHub Issue                                      |
| ------------------------------------------------------- | ------------------------------------------------- |
| `# Task N.M.K: Заголовок`                               | Title: `[N.M.K] Заголовок`                        |
| Тело (Цель, Контекст, Что сделать, Критерии, Не делать) | Body (markdown как есть)                          |
| `phase`                                                 | label `phase:N`                                   |
| `roles`                                                 | labels `type:*`                                   |
| `depends_on`                                            | упоминание в body: `Depends on: #issue1, #issue2` |
| `estimated_hours`                                       | в body или через кастомное поле Projects          |
| релиз (из RELEASES.md)                                  | milestone                                         |

**Заголовок issue** сохраняет ID `[5.3.2]` — легко искать, ссылаться, сопоставлять с карточкой.

## 4. Зависимости (depends_on)

GitHub не имеет нативных блокировок задач. Варианты:

- **Простой:** в теле issue строка `Depends on: #12, #15` (авто-линкуется). Метка `blocked` пока не закрыты.
- **Project board:** колонки `Blocked / Ready / In progress / Review / Done`. Задача в `Ready` только когда depends_on закрыты.
- **Task lists:** в issue эпика — чеклист задач (`- [ ] #12`), авто-прогресс.

## 5. Project board (kanban)

GitHub Projects (beta) — доска по всем milestone:

- **Колонки:** Backlog → Ready → In Progress → Review → Done
- **Кастомные поля:** Phase (число), Estimate (часы), Release (milestone)
- **Views:** по релизу (фильтр milestone), по типу (фильтр label), по фазе

Для MVP: отфильтровать `milestone:v0.1.0`, сортировать по порядку реализации (3→4→5→6→8→9), брать сверху.

## 6. Порядок работы над MVP

1. Начать с `phase:3` issues (Foundation), внутри — по порядку 3.1.1 → 3.1.2 → …
2. Двигаться по фазам: 3 → 4 → 5 → 6 → 8 → 9
3. Внутри фазы — по depends_on (задача готова к работе, когда её depends_on закрыты)
4. Каждая задача: реализация по «Что должно быть сделано» → проверка по «Критериям приёмки» → PR → закрыть issue
5. Эпик закрыт, когда все его задачи закрыты; milestone — когда все эпики

## 7. Импорт задач в issues

Скрипт `scripts/generate-github-issues.py` генерирует JSON/CSV из карточек (title, body, labels, milestone) для массового создания через `gh` CLI или GitHub API. См. скрипт и его README.

Пример массового создания (после генерации):

```bash
# для каждой задачи MVP:
gh issue create --title "[3.1.1] pnpm workspaces init" \
  --body-file /tmp/issue-3-1-1.md \
  --label "phase:3,type:backend,priority:mvp" \
  --milestone "v0.1.0 — MVP: One Company"
```

## Агентная разработка + GitHub

При разработке через Claude Code / Cowork:

- Агент берёт issue → читает соответствующую карточку (`docs/tasks/N-M-K-*.md`) → реализует → сверяет с критериями → открывает PR
- Заголовок `[N.M.K]` в issue = прямая ссылка на карточку
- depends_on в карточке = порядок, в котором агент берёт задачи

## Связанные документы

- [RELEASES.md](./RELEASES.md) — что в каком релизе
- [ROADMAP.md](./ROADMAP.md) — фазы и последовательность
