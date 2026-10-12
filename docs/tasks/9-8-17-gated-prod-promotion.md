---
id: '9.8.17'
phase: '9'
epic: '9.8'
status: in_progress
release: 'v0.2.0'
last_reviewed: 2026-10-12
status_note: 'Workflow, environment и скрипт защиты веток подготовлены; применение защиты веток и required reviewers в GitHub ждёт подтверждения владельца.'
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
   - SHA полный, лежит в истории `origin/main`;
   - для этого SHA есть успешный запуск workflow `CI` по событию `push` в `main`;
   - `prod` является предком SHA (только fast-forward, без force);
   - при совпадении `prod` с SHA ничего не пушится, Deploy не запускается без явного флага `redeploy`;
   - push `SHA:refs/heads/prod`, затем `gh workflow run deploy.yml --ref prod -f deployment_mode=image-bundle`;
   - итог в `GITHUB_STEP_SUMMARY`: SHA, прежний prod, ссылка на Deploy.
2. В `deploy.yml` job `deploy` получает `environment: production`. Поведение и секреты не меняются; GitHub ведёт историю выкладок, владелец может включить required reviewers.
3. `scripts/github/apply-branch-protection.sh`: идемпотентно настраивает защиту `main` (PR обязателен, обязательные проверки CI, запрет force-push/удаления) и `prod` (запрет force-push/удаления). Скрипт только печатает план без `--apply`.
4. Обновить [deploy runbook](../operations/runbooks/deploy.md) и [GITHUB_SETUP](../GITHUB_SETUP.md): основной путь продвижения — Promote; ручной FF остаётся аварийным.

## Критерии приёмки

- ✅ `pnpm format:check` проходит, YAML валиден.
- ✅ Promote отказывает: SHA не в `main`; CI на SHA не `success`; `prod` не предок SHA.
- ✅ Promote на зелёном SHA делает fast-forward `prod` и запускает Deploy с `--ref prod`; source gate Deploy (`require-prod-ref.mjs`) проходит без изменений.
- ⏸ Первое продвижение через Promote выполнено и Deploy успешен (evidence в QA-отчёте после merge).
- ⏸ Защита веток применена владельцем или с его явного согласия (`apply-branch-protection.sh --apply`).

## Подсказки

- Required status checks для `main`: имена job из `ci.yml` — `Lint · Format · Typecheck`, `Test (unit + integration)`, `Build`, `Runner image build-export-import`.
- Для личного репозитория ограничение «кто может пушить» недоступно; защита `prod` сводится к запрету force-push и удаления, чтобы Promote мог делать FF.
- `concurrency` Promote совпадает по смыслу с Deploy: один процесс продвижения за раз.

## Не делать

- ❌ Не менять шаги Deploy, rollback, smoke и секреты.
- ❌ Не давать Promote права force-push и не продвигать SHA мимо `main`.
- ❌ Не применять настройки GitHub без подтверждения владельца.
