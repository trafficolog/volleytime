---
id: '9.8.18'
phase: '9'
epic: '9.8'
status: in_progress
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-27
status_note: 'Реализация и PR; изменения .github/workflows ждут подтверждения владельца по diff в PR. Наблюдение на VPS — после первой выкладки.'
roles: [DEVOPS]
depends_on: ['9.8.10', '9.8.17']
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
decisions: ['2026-10-27 · Ретенция релизов на VPS']
tags: [ci, cd, deploy, vps, disk, retention, monitoring]
---

# Task 9.8.18: ретенция релизов на VPS и мониторинг свободного места

## Цель

Каждая выкладка image-bundle оставляет на VPS образы web, bot и migrator (~1,3–2 ГБ на релиз) и staging `.deploy/incoming/<SHA>` (~240 МБ). Старые релизы удаляются по плановой политике, которая всегда сохраняет цели отката, а свободное место видно в каждой выкладке и проверяется по расписанию.

## Контекст

2026-10-27 после трёх выкладок подряд диск VPS заполнился на 93% (2 ГБ свободно из 28 ГБ). Это угрожает capacity gate следующей выкладки («Check remote transfer capacity») и локальному backup перед миграциями. Координатор с согласия владельца очистил диск вручную: оставил 4 релиза (текущий, предыдущий как цель отката, тег `v0.2.0` `6143f42`, `b056806` / `v0.1.7`), удалил образы 11 старых SHA, теги `:latest`, старые `ghcr…:latest`, 5 staging-каталогов и build cache.

Решение владельца 2026-10-27 (передано координатору в чате, [журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md)): очистку встроить в pipeline или в мониторинговый worker.

Правило runbook «Do not prune runner/VPS images to make a failing capacity gate pass» сохраняет смысл: слепая очистка ради прохождения gate запрещена. Плановая ретенция, которая сохраняет цели отката, разрешена.

Как есть (`main` `0ef4841`): `deploy-image-bundle.sh` знает режимы `deploy`, `rollback`, `confirm-smoke`; ничего не удаляет. История успешных релизов не ведётся. Deploy workflow не показывает свободное место после выкладки. Регулярной проверки диска нет.

## Решение (обоснование)

1. **Ретенция — режим `prune-retained` того же helper-а, отдельный шаг Deploy после `confirm-smoke`.** Режим берёт тот же `.deploy/image-bundle.lock` и работает только при фазе `smoke-passed <SHA>`. Отдельный шаг с `continue-on-error: true` даёт три свойства: успех выкладки не зависит от очистки; очистка имеет свой timeout и не съедает 2-минутный бюджет подтверждения smoke; оператор запускает тот же режим вручную (`--dry-run`). Новый helper-файл не нужен: staging уже содержит `deploy-image-bundle.sh`.
2. **История успешных релизов — `.deploy/release-history`.** `confirm-smoke` после `smoke-passed` дописывает SHA (без повторов, атомарно, mode 0600). Сбой записи истории не ломает подтверждение. Ретенция считает «N последних успешных» по этому файлу, а не по образам на диске: образ неудачного кандидата не становится «успешным релизом».
3. **Fail-safe вместо догадок.** Если нельзя установить текущий или предыдущий релиз, файл истории, пинов или N некорректен, в истории меньше N релизов, Docker не отвечает или lock занят, ретенция ничего не удаляет, пишет предупреждение и завершается с кодом 0.
4. **Минимальный объём удаления.** Только теги `volleytime-(web|bot|migrator):<40 hex>` и каталоги `.deploy/incoming/<40 hex>` для SHA, которые не входят в keep set и являются предками текущего релиза в Git. `docker image rm` без `-f`; postgres, caddy, GHCR, `:latest`, `<none>` и прочие namespace не трогаются; `docker system prune` и `docker image prune` не используются. Backups, `.deploy/previous-env-*`, `.env.images*`, `.deploy/previous-git-sha`, снимки `.deploy/.split-recovery.*` и `ghcr-*` staging не удаляются. `docker builder prune` в автоматический путь не входит: в пути image-bundle VPS ничего не собирает, build cache появляется только после ручной сборки и чистится вручную по runbook.
5. **Мониторинг: Deploy summary + scheduled workflow.** Deploy в конце читает `df -Pk` на VPS (read-only SSH, `capture_stdout`) и пишет таблицу в job summary с `::warning::` ниже порога (свободно меньше 25% или меньше 5 GiB). Регулярная проверка — scheduled workflow `vps-disk-monitor.yml` каждые 6 часов с теми же read-only командами; при низком месте или недоступном VPS run падает, и GitHub уведомляет владельца штатным письмом о сбое scheduled workflow. Новых секретов нет: используются существующие `VPS_HOST`, `VPS_SSH_KEY`, `TELEGRAM_BOT_TOKEN`. Telegram-алерт через существующего бота отправляется только если владелец задаст несекретную переменную `OPS_ALERT_TELEGRAM_CHAT_ID` (его chat id; в репозитории нет переменной с chat id владельца, `SMOKE_TG_ID` — технический аккаунт). systemd timer / cron на VPS отклонён: нужна установка на VPS под root, токен бота и chat id на сервере, а результат не виден в GitHub и не проверяется в CI.
6. **Изменения `.github/workflows` — только с подтверждением владельца.** Полный diff `deploy.yml` и нового `vps-disk-monitor.yml` — в описании PR в разделе «Изменения в .github/workflows». Без подтверждения PR не мержится.

## Что должно быть сделано

1. `scripts/deploy-image-bundle.sh`:
   - режим `prune-retained FULL_SHA [--dry-run]` под `.deploy/image-bundle.lock`; занятый lock — предупреждение, код 0;
   - keep set: текущий релиз (`.env.images`, HEAD и живые web/bot совпадают с SHA), предыдущий (`.deploy/previous-git-sha` совпадает с `.env.images.previous`), N последних из `.deploy/release-history` (N из `.deploy/retain-releases`, по умолчанию 3, допустимо 1–99), пины из `.deploy/retain-pins` (одна строка — один полный SHA, `#` — комментарий), SHA образов любых контейнеров (`docker container ls --all`), SHA снимков `.deploy/.split-recovery.*`;
   - удаляет только перечисленное в п. 4 решения; лог: keep set с причинами, каждое удаление или «would remove» при `--dry-run`, сбои, свободное место до и после;
   - `confirm-smoke` дописывает SHA в `.deploy/release-history`.
2. `scripts/disk-status.sh`: читает вывод `df -Pk`, убирает дубли файловой системы, пишет таблицу в `GITHUB_STEP_SUMMARY` (или stdout), `::warning::` ниже порогов `DISK_MIN_FREE_PCT` (25) / `DISK_MIN_FREE_GIB` (5); код 1 при отсутствии данных; с `--fail-on-low` код 2 при низком месте.
3. `.github/workflows/deploy.yml`: `id: confirm` у подтверждения smoke; шаг «Prune retained releases over SSH» после него (`continue-on-error`, свой timeout); шаги чтения диска и summary с `if: always()` и `continue-on-error`.
4. `.github/workflows/vps-disk-monitor.yml`: `schedule` каждые 6 часов и `workflow_dispatch`, `permissions: contents: read`, без environment `production`; read-only SSH; падение при низком месте; опциональный Telegram-алерт.
5. Deploy runbook: политика ретенции, пины, N, история и её начальное заполнение, ручная очистка (`--dry-run`, затем запуск), мониторинг; правило «Do not prune…» переформулировано.
6. Контрактные тесты на fake shell/docker.

## Критерии приёмки

- ✅ Keep set: текущий, предыдущий, N последних успешных, пины; остальные предки текущего удаляются вместе со staging.
- ✅ Не удаётся определить текущий или предыдущий релиз (нет фазы `smoke-passed`, расхождение manifest/HEAD/runtime, нет pointer) — ничего не удаляется, код 0, предупреждение.
- ✅ Некорректные история, пины или N, история короче N, сбой Docker, занятый lock — ничего не удаляется, код 0.
- ✅ Образ, на котором есть контейнер (в том числе остановленный), не удаляется.
- ✅ postgres, caddy, GHCR, `:latest` и прочие namespace, SHA не из истории `prod`, backups и previous-env не затрагиваются; нет `-f`, `system prune`, `image prune`.
- ✅ Сбой удаления одного образа не ломает ретенцию и выкладку (код 0), staging этого SHA сохраняется.
- ✅ `--dry-run` ничего не удаляет и печатает план.
- ✅ Лог содержит keep set с причинами, удалённое и свободное место до и после.
- ✅ `confirm-smoke` ведёт историю без повторов.
- ✅ `disk-status.sh`: пороги 25% / 5 GiB, дубли, отсутствие данных, `--fail-on-low`.
- ✅ Шаг ретенции в Deploy идёт после подтверждения smoke и не может сделать выкладку неуспешной; summary диска пишется при любом исходе.
- ✅ Пять gates, deploy contract tests, `bash -n`, shellcheck (если доступен), YAML валиден.
- ✅ Владелец подтвердил diff `.github/workflows` в PR.
- ⬜ Первая выкладка после merge: шаг ретенции и summary диска наблюдались на VPS, evidence в `docs/operations/qa/`.

## Не делать

- ❌ Не очищать вслепую ради прохождения capacity gate; при недостатке места gate останавливает выкладку, как раньше.
- ❌ Не использовать `docker system prune`, `docker image prune`, `-f` для образов; не трогать postgres, caddy, volumes, backups, previous-env, снимки отката.
- ❌ Не делать выкладку неуспешной из-за ретенции.
- ❌ Не добавлять новые секреты и не менять существующие; не ходить на VPS из задачи.
- ❌ Не мержить изменения `.github/workflows` без подтверждения владельца.
