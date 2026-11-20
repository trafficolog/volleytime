---
id: '28.1.1'
phase: '28'
epic: '28.1'
status: in_progress
release: ''
sync_state: synced
last_reviewed: 2026-11-20
status_note: 'Оценка выполнена 2026-11-20 по исходникам 0.9.103 без установки; итог «можно с условиями». Ожидает ревью claude-opus-5-5.'
ref_id: ''
review_ref: ''
priority: P2
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: standard
roles: [DevOps, Security]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [tooling, graphify, supply-chain]
---

# Task 28.1.1: Оценка и проверка безопасности Graphify

## Цель

Решить, можно ли ставить Graphify на машину разработки, и какую версию: лицензия, происхождение пакета, что и куда уходит в каждом режиме.

## Контекст

- Эпик [28.1](../epics/28-1-graphify-knowledge-graph.md), раздел «Контекст» — исходные сведения на 2026-11-20.
- Цепочка поставки CI — эпик [27.2](../epics/27-2-supply-chain-ci.md); здесь только локальный инструмент.

## Что должно быть сделано

1. Лицензия Apache-2.0 и лицензии зависимостей выбранных extras (без `all`).
2. Происхождение: страница PyPI `graphifyy` — владелец проекта, ссылки на `Graphify-Labs/graphify`; `publish.yml` — публикация через PyPI Trusted Publishing или токен; наличие attestations у выбранного релиза; совпадение тега и версии на PyPI. Проверить отсутствие typo-пакетов в инструкциях проекта (`graphify`, `graphifyy`).
3. Выбрать версию: релиз не моложе двух недель на момент установки ([D-22](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-22)); записать точную версию и SHA-256 wheel и sdist с PyPI.
4. Исходники читать из sdist/wheel выбранной версии, скачанных в отдельный пустой каталог вне репозитория; распаковать как архив, ничего не запускать и не импортировать (ни `pip install`, ни `python` из этого каталога).
5. Таблица потоков данных по режимам: AST кода; семантический проход через модель ассистента; через `--backend claude` и другие backend; Ollama; `graphify add <url>`; `graphify prs --triage`; MCP-сервер; Graphify Cloud. Для каждого — что отправляется и куда. Проверить по исходному коду (п. 4) заявление «нет телеметрии» (поиск сетевых вызовов вне backend).
6. Требования к Windows: Python 3.11+ через `uv`, где `uv tool` ставит окружение. Что пишет `graphify install` с `--project` и без — по исходному коду (п. 4), не запуском.
7. Итог — раздел «Результат» в этой карточке: можно / нельзя / с условиями.

## Критерии приёмки

- ✅ Версия, хеш, способ публикации и attestations записаны со ссылками
- ✅ Таблица потоков данных по каждому режиму
- ✅ Вывод о телеметрии подтверждён по коду, а не только по README
- ✅ Ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не устанавливать пакет и не запускать `graphify` и код из скачанных архивов — это 28.1.2
- ❌ Не регистрироваться в Graphify Cloud и не создавать ключи
- ❌ Не менять код, CI и зависимости репозитория

## Результат

Проверено 2026-11-20. Wheel и sdist `0.9.103` скачаны в отдельный пустой каталог вне репозитория, распакованы как архивы и прочитаны; ничего не устанавливалось, не импортировалось и не запускалось. После проверки каталог удалён. Каталог `graphify/` в wheel и sdist совпадает (`diff -rq` пуст).

### Итог: можно, с условиями

Ставить `graphifyy==0.9.103` на машину разработки можно при условиях ниже. Без них нарушается D-22: `--project` ставит хук, скилл сам обновляет пакет без пина, при ключах в окружении CLI сам выбирает облачный backend.

1. Ставить строго с пином: `uv tool install "graphifyy==0.9.103"` (без `[all]`; extras — только `sql`, если нужен 28.1.6).
2. Не запускать `graphify install --project`, `graphify claude install`, `graphify hook install` (см. «Что пишет `graphify install`»).
3. При запуске CLI держать `GRAPHIFY_BACKEND=none`; в окружении нет `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`, `AZURE_OPENAI_API_KEY`/`AZURE_OPENAI_ENDPOINT`/`AZURE_OPENAI_DEPLOYMENT`, `AWS_PROFILE`/`AWS_REGION`/`AWS_DEFAULT_REGION`, `OLLAMA_BASE_URL`/`OLLAMA_HOST`, `GRAPHIFY_TRIAGE_BACKEND`. `GRAPHIFY_BACKEND=none` действует только на backend CLI (`llm.py`) и не мешает пути `/graphify` в сессии (subagents ассистента), которым идёт разрешённый проход 28.1.4.
4. Перед `/graphify` проверять `graphify --version` = `0.9.103`: шаг установки в скилле при отсутствии пакета выполняет `uv tool install --upgrade graphifyy` без версии.
5. Не использовать `graphify add <url>`, `graphify prs`, `graphify clone`, экспорт в Neo4j/FalkorDB и Graphify Cloud.

### Версия и происхождение

| Поле                 | Значение                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Пакет                | [`graphifyy`](https://pypi.org/project/graphifyy/0.9.103/) (две `y`); `graphify` без второй `y` — чужое имя, в инструкциях проекта не использовать                                      |
| Версия               | `0.9.103`; последняя на 2026-11-20 — `0.9.113` (2026-11-19). Следующие за `0.9.103` релизы (`0.9.104` от 2026-11-08) моложе двух недель (D-22)                                          |
| Загрузка на PyPI     | wheel 2026-11-05T16:35:42Z, sdist 2026-11-05T16:35:45Z                                                                                                                                  |
| Тег GitHub           | [`v0.9.103`](https://github.com/Graphify-Labs/graphify/releases/tag/v0.9.103), релиз опубликован 2026-11-05T16:35:13Z (автор `safishamsi`) — за 30 с до загрузки на PyPI                |
| wheel SHA-256        | `graphifyy-0.9.103-py3-none-any.whl` — `7948c030f8b04153d88bc1ee23a485ddaa0c2d6aaa03a748c177e3c217bcfe34` (1 873 975 байт)                                                              |
| sdist SHA-256        | `graphifyy-0.9.103.tar.gz` — `9ddf6c18666ee64ee65c130266b87adb45a613a9c4fe2afce7babbcbb1555b95` (3 260 685 байт)                                                                        |
| Сверка хешей         | `sha256sum` скачанных файлов совпал с `digests.sha256` в `https://pypi.org/pypi/graphifyy/0.9.103/json`                                                                                 |
| Публикация           | [`publish.yml`](https://github.com/Graphify-Labs/graphify/blob/v0.9.103/.github/workflows/publish.yml): PyPI Trusted Publishing (OIDC, `id-token: write`), окружение `pypi`, без токена |
| Attestations         | Есть у обоих файлов (PyPI Integrity API): publisher `GitHub`, `Graphify-Labs/graphify`, workflow `publish.yml`                                                                          |
| Тег = версия         | Шаг «Guard» в `publish.yml` отказывает в публикации, если `pyproject.toml` не равен тегу                                                                                                |
| Владелец репозитория | Организация `Graphify-Labs`, репозиторий создан 2026-04-03, лицензия Apache-2.0 (GitHub API)                                                                                            |
| Метаданные PyPI      | `license_expression: Apache-2.0`, `requires_python: >=3.11.5,<3.15`; ссылки Repository/Issues — `Graphify-Labs/graphify`, Homepage — `graphify.com`                                     |
| Python               | 3.11.5–3.14                                                                                                                                                                             |

Замечание по цепочке поставки: в `publish.yml` actions закреплены тегами (`actions/checkout@v4`, `astral-sh/setup-uv@v6`, `pypa/gh-action-pypi-publish@release/v1`), а не SHA. Это риск upstream; для нас его закрывает пин версии и хеша.

### Зависимости и лицензии

Базовые (ставятся всегда): `networkx` (BSD-3-Clause), `numpy` (BSD-3-Clause), `rapidfuzz` (MIT), `pyyaml` (MIT), `tree-sitter` и около 25 грамматик `tree-sitter-*` (MIT). Extras: `sql` — `tree-sitter-sql` (MIT); `mcp` — `mcp` (MIT), `starlette` (BSD-3-Clause), `anyio` (MIT); `watch` — `watchdog` (Apache-2.0). Все разрешительные. `[all]` тянет в том числе `yt-dlp`, `faster-whisper`, `anthropic`, `openai`, `boto3`, `neo4j` — не ставить. Точные версии зависимостей и их лицензии фиксируются в 28.1.2 по `uv tool` окружению.

### Сетевые вызовы и телеметрия (по коду)

Поиск по `*.py` (`urllib`, `requests`, `httpx`, `socket`, `urlopen`, URL-литералы, `subprocess`) показал:

- **Телеметрии и проверки обновлений нет.** Нет `posthog`/`sentry`/analytics, нет обращений к PyPI. Команда `graphify check-update` — локальная проверка изменённых файлов (`watch.check_update`), не сеть.
- **Единственный HTTP-клиент самого пакета** — `security.safe_fetch` (`urllib` с защитой от SSRF); его вызывает только `ingest.py` (`graphify add <url>`; arXiv, oEmbed Twitter).
- **LLM-backend** — `llm.py`: Anthropic, OpenAI, Gemini, DeepSeek, Kimi, Azure, Bedrock, Ollama, а также `claude -p` (Claude Code CLI) через `subprocess`.
- **`app.graphify.com`** встречается только в `print` (реклама облака после `install`; отключается `GRAPHIFY_NO_CTA`).
- **Внешние программы:** `git ls-files`/`git rev-parse` (локально), `gh` в `prs.py`, `git clone` в `graphify clone`, `gws drive files export` в `google_workspace.py` (только при включении `GRAPHIFY_GOOGLE_WORKSPACE`).
- **`graph.html`** подгружает JS из CDN (`unpkg.com`, `d3js.org`, `cdn.jsdelivr.net`) при открытии в браузере; данные графа при этом не отправляются.
- **Лог запросов** (`querylog.py`) по умолчанию выключен; включается `GRAPHIFY_QUERY_LOG_ENABLE=1` (пишет в `~/.cache/graphify-queries.log`).

Неожиданное поведение, которое README не описывает:

- **Автовыбор облачного backend.** `llm.detect_backend` без `GRAPHIFY_BACKEND` берёт первый найденный ключ: gemini → kimi → claude → openai → deepseek → azure → bedrock (достаточно `AWS_PROFILE`/`AWS_REGION`) → ollama.
- **Названия сообществ.** `graphify label` и `cluster-only` без ключа сами вызывают `claude -p`, если `claude` есть в `PATH` (а на машине разработки он есть). Модели уходят метки узлов и связи сообществ. Отключается только `GRAPHIFY_BACKEND=none` (значения `none|off|disable|disabled`).
- **Gemini в скилле.** Скилл `/graphify` использует Gemini, если задан `GEMINI_API_KEY`/`GOOGLE_API_KEY`; иначе семантику делают subagents сессии ассистента (D-22). Заявление скилла «graphify не читает `ANTHROPIC_API_KEY`» верно только для скилла — CLI (`extract`, `label`) эти ключи читает.

### Потоки данных по режимам

| Режим                                                   | Что отправляется                            | Куда                                                                                           | Для нас                                  |
| ------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| AST кода (`graphify update .`, `extract` без семантики) | ничего                                      | локально: читает файлы после игнора, пишет `graphify-out/`                                     | разрешено                                |
| Семантика через `/graphify` в сессии                    | содержимое документов, отобранных detect    | модель ассистента (subagents Claude Code, тот же провайдер, что и сессия)                      | разрешено D-22 по списку папок           |
| `--backend claude` и другие облачные                    | содержимое документов, метки сообществ      | API провайдера (`api.anthropic.com`, `api.openai.com`, Gemini, DeepSeek, Kimi, Azure, Bedrock) | запрещено D-22                           |
| `claude -p` (автоматически в `label`/`cluster-only`)    | метки узлов и связи сообществ               | Anthropic через Claude Code CLI                                                                | не использовать: `GRAPHIFY_BACKEND=none` |
| Ollama                                                  | содержимое документов                       | `OLLAMA_BASE_URL` (локально или удалённо; без `OLLAMA_API_KEY` выдаётся предупреждение)        | не используется                          |
| `graphify add <url>`                                    | HTTP GET по URL (User-Agent `graphify/1.0`) | сайт URL; ответ сохраняется в корпус                                                           | запрещено (28.1.4)                       |
| `graphify prs --triage`                                 | данные PR через `gh`                        | GitHub и настроенный backend (`GRAPHIFY_TRIAGE_BACKEND`)                                       | не используется                          |
| MCP-сервер (`graphify-mcp`, extra `mcp`)                | ответы на запросы к графу                   | stdio локальному клиенту; сети нет                                                             | не нужен                                 |
| Graphify Cloud                                          | —                                           | в пакете нет клиента облака, только ссылка в `print`                                           | не используется                          |

### Что пишет `graphify install` (по `install.py`)

На Windows платформа по умолчанию — `windows` (скилл `skill-windows.md`, PowerShell); на остальных ОС — `claude`.

- **`graphify install` (без `--project`).** Копирует скилл в `~/.claude/skills/graphify/SKILL.md` (или `$CLAUDE_CONFIG_DIR/skills/...`) вместе с `references/` и меткой версии. Добавляет блок регистрации скилла в `~/.claude/CLAUDE.md`. Хуков и `settings.json` не трогает, в репозиторий не пишет.
- **`graphify install --project`** для `claude`/`windows` (`_project_install`):
  - копирует скилл в `.claude/skills/graphify/` и пишет блок в `.claude/CLAUDE.md`;
  - **дополнительно** вызывает `claude_install`: секция graphify в корневой `CLAUDE.md` и хуки `PreToolUse` (Read/Glob/Grep/Bash) и `SessionStart` в `.claude/settings.json`. `--strict` делает хук блокирующим.

  Это противоречит D-22: не запускать.

- **`graphify claude install`** — то же, что вторая часть `--project` (корневой `CLAUDE.md` и хук). Не запускать.
- **`graphify hook install`** — git-хуки `post-commit`/`post-checkout` в `.git/hooks`. Не запускать (D-22).

### Игнор и что читает AST

- **Источник списка файлов.** `detect.py` берёт список из `git ls-files --cached` и правил `.gitignore`, затем добавляет `.graphifyignore` (только сужает выборку, не возвращает исключённое). Флаг `--no-gitignore` отключает только VCS-правила, `--exclude` добавляет шаблоны.
- **Встроенный фильтр секретов** пропускает:
  - `.env*` (кроме `.env.example`/`.sample`), `*.pem|key|p12|pfx|crt|der|p8`, `id_rsa*`;
  - `.netrc`, `.pgpass`, `.npmrc`, `.pypirc`, `.git-credentials`;
  - каталоги `secrets/` и `credentials/`, файлы с `secret|password|credential` в имени.

  `docs/operations` этот фильтр не исключает — его нужно добавить в `.graphifyignore` (28.1.2, 28.1.4).

- **Запись.** AST читает только отобранные файлы. Пишет `graphify-out/` (`graph.json`, `graph.html`, `GRAPH_REPORT.md`, кэш, `.graphify_root`); путь задаётся `GRAPHIFY_OUT`.

### Windows

Поддерживается явно: отдельный скилл `skill-windows.md`, блокировка файлов через `msvcrt`, отдельная ветка запуска дочернего процесса в `__main__.py` (обход падения 0xC0000005), фоновые процессы с `CREATE_BREAKAWAY_FROM_JOB`. Установка — `uv tool install "graphifyy==0.9.103"`: `uv` ставит отдельное окружение в `%APPDATA%\uv\tools\graphifyy`, а shim `graphify.exe` — в `~\.local\bin`. Python 3.11.5+ `uv` скачает сам.

### Риски

| Риск                                                                 | Мера                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Скилл ставит или обновляет `graphifyy` без версии                    | Ставить пакет заранее с пином; проверять `graphify --version` перед `/graphify` |
| CLI сам выбирает облачный backend по ключам или `AWS_*` в окружении  | `GRAPHIFY_BACKEND=none`, чистое окружение (28.1.2, 28.1.4)                      |
| `label`/`cluster-only` вызывают `claude -p` без спроса               | `GRAPHIFY_BACKEND=none`; названия сообществ — в шаге скилла в сессии            |
| `--project` ставит хук Claude Code и меняет корневой `CLAUDE.md`     | Не запускать `--project` и `graphify claude install`                            |
| `docs/operations` не попадает под встроенный фильтр секретов         | `.graphifyignore` (28.1.2), проверка `graph.json` (28.1.2, 28.1.4)              |
| Частые релизы (раз в 1–3 дня), actions upstream не закреплены по SHA | Пин версии и хеша; обновление — новым решением с той же проверкой               |
| `graph.html` подгружает JS с CDN                                     | Открывать локально; данные не уходят. Принять                                   |
