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
