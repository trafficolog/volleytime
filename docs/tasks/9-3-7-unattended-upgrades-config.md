---
id: '9.3.7'
phase: '9'
epic: '9.3'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'The production APT periodic config now matches the package reference; parser, timer and root dry-run passed without changing application runtime.'
roles:
  - DEVOPS
  - SECURITY
depends_on:
  - '9.3.2'
estimated_hours: '0.5'
tags:
  - vps
  - security
  - unattended-upgrades
  - production
---

# Task 9.3.7: исправить production unattended-upgrades config

## Цель

Восстановить валидную конфигурацию автоматических security updates на production VPS после независимо воспроизведённой синтаксической ошибки APT.

## Контекст

Пакет `unattended-upgrades` установлен, а `apt-daily-upgrade.timer` active/enabled. Однако `/etc/apt/apt.conf.d/20auto-upgrades` содержит literal backslashes вместо кавычек, поэтому любой `apt-config dump` завершается `Extra junk after value`. Task 9.3.1 остаётся открытой до отдельного исправления и повторного аудита.

## Что должно быть сделано

1. Сохранить root-only backup текущего повреждённого файла.
2. Атомарно заменить его минимальным package-reference содержимым:

   ```text
   APT::Periodic::Update-Package-Lists "1";
   APT::Periodic::Unattended-Upgrade "1";
   ```

3. Сохранить owner `root:root` и mode `0644`.
4. Проверить effective config, timer и `unattended-upgrade --dry-run`.
5. Повторно сверить критерий Task 9.3.1 без изменения SSH/firewall/runtime.

## Критерии приёмки

- [x] До исправления `apt-config dump` воспроизводимо падает на строке 1.
- [x] Повреждённый файл сохранён как датированный root-only backup.
- [x] Новый файл совпадает с package reference и разбирается APT без ошибок.
- [x] Effective values `Update-Package-Lists=1` и `Unattended-Upgrade=1`.
- [x] `apt-daily-upgrade.timer` active/enabled, dry-run завершается успешно.
- [x] SSH, firewall, Docker и application runtime не изменены.
- [x] Task 9.3.1 повторно проверена и закрыта только после GREEN evidence.

## Production evidence — 2026-09-21

- RED: `apt-config dump` returned exit `100` with `Extra junk after value` on line 1 before mutation.
- The damaged 81-byte file was moved to `/var/backups/volleytime/20auto-upgrades.bak.20260921T123504Z` with owner `root:root` and mode `0600`.
- The replacement is `root:root 0644`, byte-for-byte matches `/usr/share/unattended-upgrades/20auto-upgrades`, and `apt-config dump` exits `0` without warnings.
- Effective values are `APT::Periodic::Update-Package-Lists "1"` and `APT::Periodic::Unattended-Upgrade "1"`; `apt-daily-upgrade.timer` is active/enabled.
- Root-equivalent `unattended-upgrade --dry-run --debug` returned exit `0`, reported `upgrade result: True` and did not install packages.
- Main and recovery SSH access still resolve to `deploy`; the four application containers retained their IDs and health, public `/api/health` remained `ok`, and only 22/80/443 were externally reachable.
- No reboot, application restart, full upgrade or firewall/SSH/Docker configuration change was performed.

## Не делать

- Не запускать полный upgrade, reboot или restart application containers.
- Не менять SSH, UFW/nftables, Docker daemon или production application configuration.
- Не отключать unattended-upgrades из-за ошибки парсинга.
- Не включать credentials или secret values в evidence.
