# R0.7: полный production-кандидат — 2026-10-06

Техническая выкладка подтверждена. Реальная Telegram/pilot/owner приёмка открыта; `v0.1.7` не объявлен окончательно принятым, tag/Release не опубликованы.

## Код, review и продвижение

- Все шесть feature tasks и итоговые corrections приняты; [предыдущий code checkpoint](2026-10-05-r07-final-code-checkpoint.md) и Chrome/native200 QA сохраняются в своём scope.9.8.14 изменяет только deploy test environment и regression test, не business/schema/UI.
- [PR92](https://github.com/trafficolog/volleytime/pull/92), head `b8f14baf858cfd8db005d55450e7d723cbb937d9`: scoped independent review без Critical/Important; локальные пять gates PASS,157files/1319PostgreSQLtests. Baseline warnings/cache provenance сохранены в локальном task report, не объявлены отсутствующими.
- [Head CI37366736109 attempt2](https://github.com/trafficolog/volleytime/actions/runs/37366736109/attempts/2) all4SUCCESS. Attempt1 завершился без выполнения шагов: hosted runner acquisition incident; повтор выполнен после восстановления Actions без изменения source.
- Merge05:32:57UTC `d98ed97b1ef81dd695f4a94aafbfeafc90d4836c`, tree `34ff5ffc149a90f96625bc1c22b0e57d6fdf1877` совпадает с reviewed head (full git diff exit0). [Main CI37419085625](https://github.com/trafficolog/volleytime/actions/runs/37419085625) all4SUCCESS. Runner image build/export/import реально выполнен для обоих SHA: head archive243134921/unpacked887042048 bytes; main archive243116794/unpacked887042048 bytes.
- Все три SSH credentials проверены BatchMode; fresh VPS preflight подтвердил healthy старый967aff3, clean tracked prod, предыдущие manifest/pointer, доступные старые образы, private valid backup и отсутствие нового staging/deploy process. Root4389252KiB/tmp1004792KiB на разных устройствах; actual workflow capacity gate отдельно PASS.
- Reviewed fast-forward remote/local prod `bbd6f41→d98ed97`, main/prod совпали. Другие локальные main/auth/QA worktrees не переписаны. [Deploy37419396620](https://github.com/trafficolog/volleytime/actions/runs/37419396620) SUCCESS на exactd98ed97: source gate, Test before deploy, runner image bundle, capacity/transfer, activation, smoke, confirm-smoke. GHCR alternative skipped; server-side git pull/build не выполнялись.

## Бэкап до миграций

Workflow chronology UTC:

| Этап                     | Время    |
| ------------------------ | -------- |
| verified                 | 05:44:43 |
| loaded                   | 05:47:49 |
| backup creation          | 05:47:53 |
| backup ready / backed-up | 05:48:02 |
| migrations applied       | 05:48:20 |
| migrated                 | 05:48:27 |
| activated                | 05:48:53 |
| smoke-passed             | 05:49:46 |

Новый `/opt/volleytime/backups/volleytime_20261006_054753.sql.gz`:11246bytes,mode0600,parent0700; независимый `gzip -t` exit0. Существующие backups/images сохранены. Это проверенный dump/archive, не доказательство восстановления БД. Мигратор использует bundled Node CLI; runtime package downloads не требовались.

## Точный live SHA

VPS185.185.69.136 `/opt/volleytime`: branchprod, clean tracked Git `d98ed97b1ef81dd695f4a94aafbfeafc90d4836c`, phase `smoke-passed` того же SHA. Current image manifest all3 exactd98ed97; previous pointer `967aff312f962196e7347cc0e50f879f25f6dffa` сохранён.

| Образ    | Immutable ID                                                              |
| -------- | ------------------------------------------------------------------------- |
| web      | `sha256:bca80d88a5cc15deaa744042ca715f672aa91b06fe86f4bbde5753f5e99af0f3` |
| bot      | `sha256:f32a3c5c5070f29d25b291f3c23005727c8250746a496fe8bd75375f033ec46d` |
| migrator | `sha256:d7535ec412da1033c0f454800a0ca5051fef31489e341d15cb58879b83247c50` |

All3 OCI revisionsd98ed97; web/bot `org.volleytime.event-split-pricing=1`. Actual running web/bot IDs совпадают с этими images, оба healthy; PostgreSQLhealthy, Caddy retained. [Public health](https://volleytime.by/api/health)05:50:36UTC `status/db/auth=ok`, exactd98ed97. Bot `/healthz` statusok/modepolling/exactd98ed97. Creation capability включена для полного кандидата, secret values не публикуются.

## Synthetic smoke, не native Telegram QA

05:49:40–42UTC: health200/exactSHA, auth/get-session200, synthetic Telegram sign-in200, authenticated organizations200, forged initData401. Fixture cleanup `cleaned=true,userId=4,sessionsRemoved=1`; `SMOKE OK` и confirm-smoke SUCCESS.

Webhook route probe вернул502 в polling deployment: это не свидетельство рабочего webhook ingress или доставки Telegram updates. Polling health подтверждён отдельно. Synthetic sign-in не доказывает native client/platform UX и получение личных сообщений реальными аккаунтами.

## Ручная приёмка остаётся открытой

Тестовая организация и два реальных Telegram аккаунта — owner и player. Фиксировать actual platform/client version, наблюдаемые результаты и дефекты, не предполагать непроверенные Android/iOS/Desktop.

1. Открыть действующий бот/Mini App, invitation/deeplink, real initData, роли, Back и light/dark. Историческая R0.6 manual acceptance отдельно открыта.
2. Published split event,target10.01BYN,capacity2: оба записываются через Telegram. До распределения reservation/forecast, не free/paid; cash/transfer доступны, subscription недоступен даже при активном абонементе.
3. Owner распределяет: earlier booking5.01BYN,second5.00BYN,sum10.01. Каждый видит и получает только свою exact сумму; organizer видит две ожидающие оплаты. Повтор не создаёт дубликаты платежей/ledger/notifications.
4. Confirm одного: exactincome/notification. Reject другого: booking удалён, settled shares не перераспределяются, settled waitlist не продвигается. Повтор не удваивает деньги. Event cancellation возвращает только действительно оплаченные суммы и сохраняет history.
5. Отдельный unsettled split capacity1: второй waitlist; cancellation/promotion до распределения. После распределения новые joins/mode/target edits отвергаются. Fixed/free/subscription regression — в отдельных событиях, включая cancellation/refund/restore.
6. Зафиксировать owner pilot acceptance; только затем done/tag/Release и остановка наблюдения. Сейчас9.8.11/release `in_progress`.

Критический финансовый/access дефект останавливает приёмку. Split-safe recovery следует [runbook](../runbooks/deploy.md): captured compatible current runtime, все writers quiescent под lock и authoritative schema/split query. Нельзя fixed-only downgrade при split rows, удаление данных/DBrestore ради совместимости или переписывание tags. Production rollback/isolated restore, S3, external monitoring, repaired webhook ingress и неделя тренировок этой выкладкой не подтверждены.
