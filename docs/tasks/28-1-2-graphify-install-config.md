---
id: '28.1.2'
phase: '28'
epic: '28.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-20
status_note: 'Запрос владельца 2026-11-20. Стартует после вывода 28.1.1 «можно».'
ref_id: ''
review_ref: ''
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: standard
roles: [DevOps, Security]
depends_on: ['28.1.1']
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [tooling, graphify, secrets]
---

# Task 28.1.2: Установка и настройка Graphify

## Цель

Graphify ставится одной воспроизводимой командой закреплённой версии; правила игнора не пускают в граф секреты, служебные данные выкладки и шум.

## Контекст

- Версия и условия — результат [28.1.1](28-1-1-graphify-evaluation.md).
- Корневой `.gitignore` уже исключает `node_modules`, `.env*` (кроме `.env.example`), `dist`, `.nuxt`, `.output`, `coverage`, `output/`; Graphify учитывает `.gitignore`.
- Ключи VPS лежат вне репозитория; сканировать только корень репозитория.
- `graphify install` (уровень пользователя, без `--project`) пишет вне репозитория, в профиль пользователя: `~/.claude/skills/graphify/` и блок в `~/.claude/CLAUDE.md`; хуков не ставит. `--project`, `graphify claude install` и `graphify hook install` запрещены ([D-22](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-22), дополнение 2026-11-20).
- Каждый запуск CLI — с `GRAPHIFY_BACKEND=none`, без ключей провайдеров (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` и др.) и `AWS_*` в окружении; перед запуском `graphify --version` = `0.9.103`. Сначала ставится закреплённая версия; давать скиллу самому ставить или обновлять пакет нельзя.

## Что должно быть сделано

1. Установка: `uv tool install "graphifyy==<версия из 28.1.1>"` с нужными extras и проверкой хеша из 28.1.1 (`--require-hashes` с файлом требований или эквивалент для `uv tool`; если `uv tool` этого не умеет — записать ограничение и сверить хеш скачанного wheel вручную до установки); команда и проверка `graphify --version` — в [guides](../guides/) (новый `graphify.md`).
2. `.graphifyignore` в корне репозитория (в git): `.env*`, `*.pem`, `*.key`, `id_*`, `*.p12`, `**/secrets/**`, `pnpm-lock.yaml`, `.pnpm-store`, `.turbo`, `.worktrees`, `.claude/worktrees`, `.claude/settings.local.json` и прочие локальные файлы `.claude/` (`*.local.*`), `output/`, `graphify-out/`, `docs/operations/` ([D-22](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-22)), тяжёлые бинарные файлы дизайна (`*.png`, `*.jpg`, `*.webp`, `*.pdf`, `*.fig`, видео).
3. `.graphifyrc` в корне при необходимости (например, `.vue` — проверить, что разбирается; если нет — записать ограничение).
4. `graphify-out/` — в `.gitignore` (D-22).
5. Пробный запуск `graphify extract` только AST: в окружении нет `ANTHROPIC_API_KEY` и других ключей backend, интеграция с ассистентом (`graphify install`) не установлена; отчёт о пропущенных путях сверить с ожидаемым.
6. Проверка: поиск по `graph.json` строк `BEGIN`, `PRIVATE KEY`, `TOKEN=`, `PASSWORD`, IP-адресов VPS и путей `docs/operations` — ноль совпадений; результат в guide.

## Критерии приёмки

- ✅ Одна команда установки с точной версией в guide
- ✅ `.graphifyignore` в репозитории, `graphify-out/` не попадает в git
- ✅ Проверка `graph.json` на секреты пуста
- ✅ Пять gates CODING_STANDARDS на tested revision (prettier для новых файлов); ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не ставить хук Claude Code и git-хуки — это 28.1.5
- ❌ Не запускать семантический проход — это 28.1.4
- ❌ Не добавлять Graphify в `package.json`, CI и Docker-образы
- ❌ Не указывать путь к ключам VPS и сами секреты в документах
