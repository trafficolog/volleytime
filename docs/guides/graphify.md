# Graphify: установка и запуск

> Инструмент разработчика (эпик [28.1](../epics/28-1-graphify-knowledge-graph.md)); в `package.json`, CI и Docker-образы не входит. Решение и ограничения — [D-22](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-22), оценка версии — [28.1.1](../tasks/28-1-1-graphify-evaluation.md).

Пакет называется `graphifyy` (две `y`). Версия закреплена: `0.9.103`, SHA-256 wheel `7948c030f8b04153d88bc1ee23a485ddaa0c2d6aaa03a748c177e3c217bcfe34`.

## Требования

- Python 3.11.5 или новее, [uv](https://docs.astral.sh/uv/) (проверено на Python 3.14.0, uv 0.13.9, Windows 11).

## Установка (PowerShell)

`uv tool install` не принимает хеш (нет `--require-hashes` и подобного флага), поэтому хеш wheel сверяется вручную до установки. Каталог загрузки — новый и пустой, вне репозитория.

```powershell
$d = Join-Path $env:TEMP "graphifyy-0.9.103"
New-Item -ItemType Directory $d | Out-Null
$url = "https://files.pythonhosted.org/packages/ff/fe/ff1474a96b2abe3ae15a7554195797f9af184067e57d6d200d43e78e137e/graphifyy-0.9.103-py3-none-any.whl"
$whl = Join-Path $d "graphifyy-0.9.103-py3-none-any.whl"
Invoke-WebRequest $url -OutFile $whl
if ((Get-FileHash $whl -Algorithm SHA256).Hash.ToLower() -ne "7948c030f8b04153d88bc1ee23a485ddaa0c2d6aaa03a748c177e3c217bcfe34") { Remove-Item $whl -Force; throw "SHA-256 mismatch" }
uv tool install $whl
```

Ссылку на файл можно перепроверить в `https://pypi.org/pypi/graphifyy/0.9.103/json` (поле `digests.sha256`, значение должно совпасть). Без extras: `sql` нужен только для 28.1.6.

Ограничение: проверен хеш самого wheel. Зависимости (30 пакетов: `networkx`, `numpy`, `pyyaml`, `rapidfuzz`, `tree-sitter` и грамматики) `uv tool install` подтягивает с PyPI без хешей. Принято как остаточный риск уровня инструмента разработчика.

Необязательное усиление (не требуется для приёмки): закрепить зависимости с хешами. Взять версии из вывода установки и `digests.sha256` каждого файла из `https://pypi.org/pypi/<пакет>/<версия>/json`, записать в `requirements.txt` вне репозитория строки `пакет==версия --hash=sha256:...` (для всех файлов нужной платформы), затем ставить в отдельное окружение: `uv venv <каталог>`, `uv pip install --python <каталог> --require-hashes --no-deps -r requirements.txt <wheel>`. Либо ограничить версии зависимостей без хешей: `uv tool install --constraint <файл> <wheel>`. Для `uv tool` готового флага проверки хешей нет.

Проверка (каждый раз перед запуском):

```powershell
graphify --version   # graphify 0.9.103
```

`graphify install` (скилл ассистента на уровне пользователя) в 28.1.2 не выполняется — это шаг 28.1.4. Запрещены `graphify install --project`, `graphify claude install`, `graphify hook install`, `graphify add`, `graphify prs`, `graphify clone`, экспорт в Neo4j/FalkorDB и Graphify Cloud.

## Запуск только AST (без LLM)

В процессе должно быть `GRAPHIFY_BACKEND=none`, а ключей провайдеров и `AWS_*` — нет.

```powershell
$env:GRAPHIFY_BACKEND = "none"
foreach ($v in "GEMINI_API_KEY","GOOGLE_API_KEY","ANTHROPIC_API_KEY","OPENAI_API_KEY","DEEPSEEK_API_KEY","MOONSHOT_API_KEY","AZURE_OPENAI_API_KEY","AZURE_OPENAI_ENDPOINT","AZURE_OPENAI_DEPLOYMENT","AWS_PROFILE","AWS_REGION","AWS_DEFAULT_REGION","OLLAMA_BASE_URL","OLLAMA_HOST","GRAPHIFY_TRIAGE_BACKEND") { Remove-Item "Env:$v" -ErrorAction SilentlyContinue }
graphify --version
graphify extract . --code-only --no-cluster
```

`--code-only` не запускает семантический проход (документы, изображения пропускаются). Результат — `graphify-out/` в корне репозитория; он в `.gitignore` и не коммитится. Запускать только из корня репозитория.

Сообщества и `GRAPH_REPORT.md` строятся локально и без LLM, если не просить имена:

```powershell
graphify cluster-only . --no-label --no-viz
```

`--no-label` оставляет заглушки «Community N» и не вызывает модель; `--no-viz` не создаёт `graph.html` (граф больше 5000 узлов). Вызов без `--no-label` запрещён: имена сообществ даёт LLM (`claude -p`, если `GRAPHIFY_BACKEND` не `none`). `graphify label` не запускать.

Вопросы к графу: `graphify query|path|explain|affected "<имя>"` (граф по умолчанию — `graphify-out/graph.json`). Они читают только локальный `graph.json`.

## Обновление графа

Когда обновлять, где и кто — правило [ORCHESTRATION](../ORCHESTRATION.md#граф-знаний-graphify) (дополнение D-22 от 2026-11-22). Команды — в worktree `.claude/worktrees/graphify` (первый раз: `git worktree add --detach .claude/worktrees/graphify origin/main`), с теми же условиями окружения, что и выше:

```powershell
graphify --version                     # graphify 0.9.103
if ($env:GRAPHIFY_BACKEND -ne "none") { throw "GRAPHIFY_BACKEND must be none" }
git fetch origin
git switch --detach origin/main
if ((git rev-parse HEAD) -ne (git rev-parse origin/main)) { throw "HEAD != origin/main" }
graphify update .                      # закрыта задача
# закрыт эпик — вместо update:
# graphify extract . --code-only --no-cluster
# graphify cluster-only . --no-label --no-viz
git rev-parse origin/main | Out-File -Encoding ascii graphify-out/.built-sha
```

Проверено 2026-11-22 на 0.9.103 (`GRAPHIFY_BACKEND=none`): `update` занял 14 с и переписал `graph.json`, `GRAPH_REPORT.md` и `graph.html`. `graph.html` от `update` принимается: каталог в `.gitignore`, файл не коммитится и не открывается; запрет `cluster-only` без `--no-viz` остаётся. `graph.json` и `manifest.json` коммит сборки не хранят, отсюда метка `.built-sha`.

## Запросы из worktree задачи

Действующий граф один, в `.claude/worktrees/graphify`; из любого worktree к нему обращаются через `--graph` (проверено 2026-11-22):

```powershell
$G = Join-Path (git rev-parse --path-format=absolute --git-common-dir) "../.claude/worktrees/graphify/graphify-out/graph.json"
Get-Content (Join-Path (Split-Path $G) ".built-sha")      # сверить с git rev-parse origin/main
graphify affected "packages/core/src/ledger/service.ts" --depth 3 --graph $G
graphify explain "ledger/service.ts" --graph $G
graphify path "bookings.post.ts" "bookings" --graph $G
```

- Узел файла ищется по полному пути от корня или по уникальному хвосту (`ledger/service.ts`); короткое имя вроде `service.ts` неоднозначно.
- `--depth 1` у файла за barrel `index.ts` показывает только `re_exports` и тесты; вызывающие — с `--depth 3`.
- Граф строится по `origin/main`: изменений ветки задачи в нём нет.
- Правила по ролям — [ORCHESTRATION](../ORCHESTRATION.md#граф-знаний-graphify).

## Правила игнора

Файл [`.graphifyignore`](../../.graphifyignore) (синтаксис gitignore) складывается с `.gitignore` и может только добавлять исключения. Исключены: `.env*`, ключи (`*.pem`, `*.key`, `id_*`, `*.p12`, `**/secrets/**`), `docs/operations/`, локальные файлы ассистента и worktrees, `node_modules`, сборка и `output/`, `pnpm-lock.yaml`, изображения, PDF, `*.fig`, видео, шрифты (`*.woff`, `*.woff2`, `*.ttf`, `*.otf`), `*.ico`. Ключи VPS лежат вне репозитория и в область сканирования не попадают. `.graphifyrc` не нужен: `.vue` разбирается штатно.

## Результат пробного запуска (2026-11-20)

Граф кода и конфигурации; `main` на `85854be7`. Значения секретов не записываются.

| Показатель                           | Значение                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Файлов кода                          | 1381 (документы, изображения не читались: `--code-only`)                           |
| Пути, пропущенные правилами игнора   | 166 (в их числе `.env.example`, `.env.prod.example`, изображения)                  |
| Пропущено как «возможно секретные»   | 2 (`secret-scan.yml`, `tokens.css`)                                                |
| Узлов / рёбер                        | 8759 / 21710                                                                       |
| Узлы по расширению файла источника   | `.ts` 5000, `.vue` 2402, `.yml` 446, `.json` 326, `.jsx` 322, `.sh` 116, `.mjs` 75 |
| Файлы `.sql` (73)                    | не разобраны: нужен extra `sql` (28.1.6)                                           |
| Узлов из `.claude/`, lock, `output/` | 0                                                                                  |

Проверка `graph.json` (число совпадений):

| Поиск                                                                   | Совпадений                                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `BEGIN`, `PRIVATE KEY`, `TOKEN=`, `SECRET...=`, `ssh-rsa`/`ssh-ed25519` | 0                                                                                             |
| IPv4-адреса, имена хостов (`*.com/.ru/.by/...`)                         | 0                                                                                             |
| `docs/operations`, `.env`, путь к ключам VPS                            | 0                                                                                             |
| `PASSWORD` (без учёта регистра)                                         | 18: только имена ключей YAML (`POSTGRES_PASSWORD`, `DB_PASSWORD`, `password`) без значений    |
| E-mail                                                                  | 2: ложные, `пакет@версия` (`h3@...`, `playwright-core@...`)                                   |
| Строки из 40+ символов подряд                                           | 43188: все похожи на идентификаторы узлов; случайных строк (буквы разных регистров и цифры) 0 |

Вывод: секретов, адресов и путей `docs/operations` в графе нет. Граф содержит имена ключей конфигурации из `.github/workflows` и compose-файлов; значения не извлекаются.

## Базовая линия (28.1.3, 2026-11-20)

Сборка из корня worktree `main` на `4b6c6b7e`, `graphify 0.9.103`, `GRAPHIFY_BACKEND=none`, ключей провайдеров в окружении нет. Windows 11, 24 воркера AST.

| Показатель                  | Значение                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Время `extract --code-only` | 17 с (кэш пуст); `graph.json` 9,5 МБ                                                                                                                                     |
| Время `cluster-only`        | 4 с                                                                                                                                                                      |
| Узлов / рёбер               | 8759 / 21710 в `graph.json`; 19744 в отчёте после загрузки (одинаковые пары узлов схлопываются)                                                                          |
| Сообществ                   | 406 (356 в отчёте, 50 тонких опущены), имена «Community N»                                                                                                               |
| Происхождение рёбер         | 98% EXTRACTED, 2% INFERRED (405 рёбер, средняя уверенность 0,85)                                                                                                         |
| Рёбра по типу               | `contains` 7194, `imports` 5631, `imports_from` 3897, `calls` 3377, `re_exports` 687, `indirect_call` 371, `method` 146                                                  |
| Узлы по областям            | `apps/web` 4972, `packages/core` 1511, `packages/db` 460, `docs/design` 325, `.github/workflows` 309, `packages/shared` 266, `apps/bot` 258, `packages/auth` 131         |
| Не разобрано                | 73 `.sql` (нужен extra `sql`, 28.1.6); 319 файлов без символов, в основном `*.test.ts` (`describe`/`it` не узлы)                                                         |
| Топ god nodes               | `users` 214, `db` 206, `organizations` 203, `closeDb()` 164, `vue` 135, `organizationService` 135, `getDb()` 101, `@vue/test-utils` 100, `events` 95, `memberService` 84 |
| Циклы импортов              | не найдены                                                                                                                                                               |

Что видно в отчёте:

- Полезно: слой «эндпоинт → сервис → таблица» и обратные импортёры любого модуля (`affected`, `explain`) строятся быстро и верно на уровне файлов и экспортируемых символов.
- Шум: god nodes — таблицы схемы и внешние пакеты (`vue`, `@vue/test-utils`), а не архитектурные хабы; сообщества без имён читаются плохо; «Surprising Connections» целиком состоят из связей `*.test.ts` с прототипами `docs/design/reference-v3/handoff/*.jsx` (325 узлов `docs/design`: шум для графа кода, решает 28.1.4).
- Ограничение: методы объектов-сервисов (`bookingService.cancel`, `ledgerService.getBalance`, `promoteFromWaitlist`) узлами не являются, `dynamic_import` связывает файлы, а не символы. «Кто вызывает метод» даёт всех импортёров сервиса, а для методов, не вынесенных в отдельные функции, — «нет узла».

Контрольные вопросы (ответ графа сверен с кодом поиском по репозиторию):

| #   | Вопрос                                                    | Команда                                                        | Ответ графа                                                                                                                                                                     | Оценка                                                                                                      |
| --- | --------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Путь от эндпоинта записи на событие до таблицы `bookings` | `path "bookings.post.ts" "bookings"`                           | `bookings.post.ts` → `bookingService` ← `bookings/service.ts` → `bookings`, 3 звена, все EXTRACTED                                                                              | верно: цепочка совпадает с кодом (`bookingService.book` → `insert(bookings)`); метод `book` в пути не виден |
| 2   | Кто вызывает `ledgerService.getBalance`                   | `affected "getBalance"`, `explain "ledgerService"`             | `getBalance` не найден; `ledgerService` импортируют 8 модулей, среди них `dashboard.get.ts` и `ledger/index.get.ts`                                                             | частично: оба реальных вызывающих в списке, но среди импортёров есть не вызывающие метод                    |
| 3   | Где проверяется `initData`                                | `affected "validateInitData"`, `explain`                       | прямые вызовы `linkTelegramToUser()` и `authenticateViaTelegram()` (рёбра `calls`), выше — `telegramPlugin()`                                                                   | верно: совпадает с `grep` (`linking.ts:23`, `authenticate.ts:72`)                                           |
| 4   | Кто вызывает `promoteFromWaitlist`                        | `explain "promoteFromWaitlist"`, `query "promoteFromWaitlist"` | узла нет (код 4); в коде 3 вызова: `bookings/service.ts` (2), `payments/service.ts`                                                                                             | неверно: метод объекта-сервиса не попал в граф                                                              |
| 5   | Кто вызывает `bookingService.cancel`                      | `affected "bookingService" --depth 1`, `path`                  | 13 импортёров сервиса; из реальных вызывающих `cancel.post.ts`, `bot/service.ts`, `exclude.ts`; `payments/service.ts` — только как `dynamic_import` файла `bookings/service.ts` | частично: вызывающие находятся, но с лишними и без указания метода                                          |

Итог: 2 верно, 2 частично, 1 неверно. Граф надёжен для вопросов уровня модулей и экспортируемых функций и слаб для методов объектов-сервисов, на которых построен `packages/core`.

Проверка `graph.json` (28.1.3; число совпадений, значения не записываются):

| Поиск                                                                           | Совпадений                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `BEGIN `, `PRIVATE KEY`, `TOKEN=`, `SECRET...=`, `ssh-rsa`/`ssh-ed25519`        | 0                                                                                           |
| Ключи провайдеров (`sk-`, `ghp_`, `AKIA`, `xox`)                                | 0                                                                                           |
| IPv4-адреса, имена хостов (`*.com/.ru/.by/.net/.org/.io/.dev/.app/.cloud/.xyz`) | 0                                                                                           |
| `docs/operations`, `.env`, `keys-vps`, `id_rsa`, `.pem`, `.key`                 | 0                                                                                           |
| `PASSWORD` (без учёта регистра)                                                 | 24: только имена ключей YAML (`POSTGRES_PASSWORD`, `DB_PASSWORD`, `password`), без значений |
| E-mail                                                                          | 4: ложные, `h3@версия` и `playwright-core@версия` (метка и нормализованная метка)           |
| Строки из 40+ символов подряд                                                   | 43189: идентификаторы узлов; случайных (разный регистр и цифры) 0                           |

Секретов, адресов и путей `docs/operations` в графе нет; результат совпадает с пробным запуском 28.1.2.
