# SDD reconciliation R0/MVP — 2026-09-18

## Цель

Сверить исторические статусы task cards фаз 3, 4, 5, 6, 8 и 9 с фактической реализацией, hardening-релизами v0.1.1/v0.1.2 и свежим GitHub CI. Reconciliation не расширяет MVP scope и не подменяет external/manual acceptance.

## Итог

До reconciliation в R0-фазах было **236 task cards: 117 done и 119 non-done**. После сверки существующих карточек **101 карточка закрыта evidence-backed**, а **18 остаются реально открытыми**. Добавлена служебная задача 9.11.2, поэтому итоговый снимок: **237 cards / 219 done / 18 non-done**.

Свежий repository gate:
- PR #1: Lint · Format · Typecheck — success;
- PR #1: Test (unit + integration) — success;
- PR #1: Build — success;
- Deploy run 35346916965: pre-deploy tests — success;
- Deploy run 35346916965: build/push web + migrator + bot — success;
- Deploy to VPS — failure до SSH: `missing server host`, production secrets/VPS ещё не настроены.

## Что было status drift

Закрыты исходные cards, у которых код уже существовал, а открытые review findings были устранены фикс-эпиками:
- Phase 4: все старые non-done, кроме 4.7.5;
- Phase 5: все старые non-done, включая 5.10.1/5.10.2/5.10.3;
- Phase 6: все старые non-done, включая 6.3.2;
- Phase 8: все старые repository cards до 8.7.1;
- Phase 9: 9.2.1;
- release-readiness task 9.11.1.

Основание: fix-эпики 4.9, 5.13, 6.8, 8.8, 9.9 и follow-up 3.10/5.14/6.9/8.9/9.10 имеют done status; повторное ревью подтвердило 21/21 P0 первого аудита; свежий GitHub CI зелёный.

## 18 реально открытых карточек

| Task | Категория | Remaining evidence |
| --- | --- | --- |
| 4.7.5 | repository UI gap | Есть dashboard/audit API/archive API, но нет Mini App routes `/audit` и `/settings`. |
| 8.7.2 | manual Telegram QA | Реальный iOS/Android/Desktop Telegram прогон не выполнен. |
| 8.8.11 | manual Telegram QA | Та же внешняя проверка; это один underlying gate с 8.7.2. |
| 9.1.1 | production runtime validation | Web image build/push зелёный; запуск контейнера на production stack не подтверждён. |
| 9.1.2 | production runtime validation | Bot image build/push зелёный; runtime на production stack не подтверждён. |
| 9.2.2 | DNS/TLS validation | Caddy routing проверен локально; live TLS/domain не проверены. |
| 9.3.1 | external infrastructure | VPS/SSH/firewall/fail2ban не provisioned/verified. |
| 9.3.2 | external infrastructure | Docker/deploy user/VPS directory не provisioned/verified. |
| 9.4.1 | external Telegram/DNS | DNS, HTTPS и BotFather Mini App configuration не verified. |
| 9.5.1 | production Telegram | Live setWebhook/getWebhookInfo/update delivery не verified. |
| 9.5.2 | production notification | Internal listener реализован; live delivery не verified. |
| 9.6.1 | observability | Sentry web код есть; реальный DSN/event не verified. |
| 9.6.2 | observability | Sentry bot код есть; UptimeRobot и реальные alerts не настроены. |
| 9.7.1 | backup operations | Backup script есть; S3 upload/cron/alert на production не verified. |
| 9.7.2 | restore operations | Restore script/runbook есть; real-backup restore test не выполнен. |
| 9.8.1 | deployment | Tests/build/push прошли; SSH deploy не стартовал из-за отсутствующего VPS_HOST. |
| 9.8.2 | repository + configuration gap | Migrator есть, но workflow не materialize-ит production secrets в `.env`; VPS secrets также не настроены. |
| 9.8.3 | repository + external gap | Rollback реализован, но build-on-VPS fallback/runbook отсутствует; полный pipeline/rollback не verified. |

## Release consequence

Repository CI теперь не является blocker. Однако формулировка **all R0 SDD done** пока неверна: остаются 18 open cards. До тега v0.1.3 необходимо либо реализовать/явно descoped repository gaps, либо пройти соответствующие external/manual acceptance criteria. Production MVP по-прежнему требует Telegram QA, VPS deploy + smoke, backup/restore/monitoring и неделю реального использования.
