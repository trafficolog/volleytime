---
id: '9.3.7'
phase: '9'
epic: '9.3'
status: todo
sync_state: local
last_reviewed: 2026-09-21
status_note: 'Independent Task 9.3.1 audit reproduced a syntax error in /etc/apt/apt.conf.d/20auto-upgrades; no remediation has been applied yet.'
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

- [ ] До исправления `apt-config dump` воспроизводимо падает на строке 1.
- [ ] Повреждённый файл сохранён как датированный root-only backup.
- [ ] Новый файл совпадает с package reference и разбирается APT без ошибок.
- [ ] Effective values `Update-Package-Lists=1` и `Unattended-Upgrade=1`.
- [ ] `apt-daily-upgrade.timer` active/enabled, dry-run завершается успешно.
- [ ] SSH, firewall, Docker и application runtime не изменены.
- [ ] Task 9.3.1 повторно проверена и может быть закрыта только после GREEN evidence.

## Не делать

- Не запускать полный upgrade, reboot или restart application containers.
- Не менять SSH, UFW/nftables, Docker daemon или production application configuration.
- Не отключать unattended-upgrades из-за ошибки парсинга.
- Не включать credentials или secret values в evidence.
