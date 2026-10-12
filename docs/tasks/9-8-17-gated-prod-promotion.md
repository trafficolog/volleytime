---
id: '9.8.17'
phase: '9'
epic: '9.8'
status: done
release: 'v0.2.0'
last_reviewed: 2026-10-13
status_note: 'Ручной FF b056806 + Deploy 38317488959 success, Promote no-op 38318437096, защита веток применена 2026-10-13; evidence docs/operations/qa/2026-10-13-cicd-promotion.md.'
roles: [DEVOPS]
depends_on: ['9.8.16']
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
tags: [ci, cd, github-actions, promotion]
---

# Task 9.8.17: управляемое продвижение main → prod через GitHub Actions

## Цель

Убрать ручной `git push main:prod` из обычной выкладки: проверенный SHA из `main` продвигается в `prod` одной кнопкой в Actions, только после зелёного CI на этом SHA, и сразу запускает существующий Deploy.

## Контекст

Аудит 2026-10-12 ([отчёт](../operations/reviews/2026-10-12-project-audit.md)): CI (`ci.yml`) и Deploy (`deploy.yml`, image-bundle по SSH, backup → migrate → smoke → rollback) работают, последние выкладки успешны. Пробелы:

- продвижение `main → prod` выполняется вручную с локальной машины, проверка «CI зелёный на этом SHA» держится на дисциплине;
- `main` и `prod` без защиты веток, force-push и удаление не запрещены;
- у Deploy нет GitHub Environment, поэтому нет истории выкладок в UI и нельзя включить обязательное подтверждение.

Push от `GITHUB_TOKEN` не запускает workflow по событию `push`, а `workflow_dispatch` запускает. Поэтому продвижение делает fast-forward `prod` и затем явно вызывает Deploy на `prod`.

## Что должно быть сделано

1. `.github/workflows/promote.yml` (`workflow_dispatch`, вход `sha`, по умолчанию текущий `main`):
   - SHA полный, лежит в истории `origin/main`; для него есть успешный `CI` по push в `main`; `prod` — предок SHA;
   - при совпадении `prod` с SHA ничего не делает (повторная выкладка того же SHA требует ручного аудита staging и не предлагается);
   - `GITHUB_TOKEN` не может пушить диапазон с изменениями `.github/workflows/` и не запускает `on: push`: с секретом `PROMOTE_TOKEN` (fine-grained PAT, Contents + Workflows) push идёт им и Deploy стартует от push; без секрета — push `GITHUB_TOKEN`, затем `gh workflow run deploy.yml --ref prod` после проверки `prod == SHA`; диапазон с workflow-файлами без секрета отклоняется до push с инструкцией ручного FF;
   - итог в `GITHUB_STEP_SUMMARY`, включая неуспешный push или dispatch.
2. В `deploy.yml` job `deploy` получает `environment: production`. Поведение и секреты не меняются; GitHub ведёт историю выкладок, владелец может включить required reviewers.
3. `scripts/github/apply-branch-protection.sh`: идемпотентно настраивает защиту `main` (PR обязателен, обязательные проверки CI, в том числе для администраторов, `strict: false`, запрет force-push/удаления) и `prod` (запрет force-push/удаления). Скрипт только печатает план без `--apply`.
4. `ci.yml`: отмена устаревших прогонов только для PR; каждый SHA `main` сохраняет свой CI, иначе его нельзя продвинуть.
5. Обновить [deploy runbook](../operations/runbooks/deploy.md) и [GITHUB_SETUP](../GITHUB_SETUP.md): основной путь продвижения — Promote; ручной FF остаётся аварийным.

## Критерии приёмки

- ✅ `pnpm format:check` проходит, YAML валиден.
- ✅ Promote отказывает: SHA не в `main`; CI на SHA не `success`; `prod` не предок SHA.
- ✅ Promote на зелёном SHA делает fast-forward `prod` и запускает Deploy с `--ref prod`; source gate Deploy (`require-prod-ref.mjs`) проходит без изменений.
- ✅ Диапазон с изменениями `.github/workflows/` без `PROMOTE_TOKEN` отклоняется до push с понятной ошибкой.
- ✅ Первое продвижение, содержащее сам `promote.yml`, выполнено ручным reviewed FF.
- ✅ Первое продвижение (ручной FF, т.к. диапазон меняет workflow) и Deploy успешны; Promote проверен no-op прогоном ([evidence](../operations/qa/2026-10-13-cicd-promotion.md)).
- ✅ Защита веток применена с согласия владельца 2026-10-13.

## Подсказки

- Required status checks для `main`: имена job из `ci.yml` — `Lint · Format · Typecheck`, `Test (unit + integration)`, `Build`, `Runner image build-export-import`.
- Для личного репозитория ограничение «кто может пушить» недоступно; защита `prod` сводится к запрету force-push и удаления, чтобы Promote мог делать FF.
- `concurrency` Promote совпадает по смыслу с Deploy: один процесс продвижения за раз.

## Не делать

- ❌ Не менять шаги Deploy, rollback, smoke и секреты.
- ❌ Не давать Promote права force-push и не продвигать SHA мимо `main`.
- ❌ Не применять настройки GitHub без подтверждения владельца.
