---
id: '9.3.3'
phase: '9'
epic: '9.3'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Live hardening and post-change smoke pass; task remains open only until the owner copies the recovery private key to storage independent of the daily-key system.'
roles:
  - DEVOPS
depends_on:
  - '9.3.1'
  - '9.3.2'
estimated_hours: '1-2'
tags:
  - vps
  - ssh
  - recovery
  - security
---

# Task 9.3.3: recovery-safe SSH-доступ production VPS

## Цель

Закрыть root/password SSH на production VPS без риска необратимого локаута: ежедневный доступ выполняется отдельным `deploy`-ключом, аварийный — независимым `ops-recovery`-ключом, третья линия восстановления — консоль/rescue хостинга.

## Контекст

Live-аудит выделенного VPS показал работающий root key login, но также `PermitRootLogin yes`, `PasswordAuthentication yes`, отсутствующие `deploy`/`ops-recovery`, неактивный UFW и отсутствие swap. Для пилота на одной организации достаточно текущих 2 vCPU / 2 GB RAM при добавлении 2 GB swap и ограничений контейнеров.

## Что должно быть сделано

1. Создать отдельные ключи `deploy` и `ops-recovery`; recovery private key должен храниться отдельно от ежедневной системы после передачи владельцу.
2. Создать пользователей:
   - `deploy`: shell, группа `docker`, владелец `/opt/volleytime`, без общего sudo;
   - `ops-recovery`: shell, независимый ключ, аварийный `sudo`.
3. В отдельных новых SSH-сессиях доказать:
   - `deploy` входит своим ключом и выполняет `docker ps`;
   - `ops-recovery` входит своим ключом и выполняет `sudo -n true`.
4. Добавить проверяемый drop-in `sshd_config.d` с `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin no`, `PubkeyAuthentication yes`; перед reload выполнить `sshd -t`.
5. После reload повторить оба положительных входа и отрицательный root key login.
6. Включить UFW только для 22/80/443, fail2ban и unattended upgrades.
7. Добавить 2 GB swap, timezone `Europe/Minsk`, проверить сервисы и доступность SSH.
8. Зафиксировать только не-секретные live evidence в карточке/runbook.

## Критерии приёмки

- ✅ `deploy` key login и Docker без sudo подтверждены после hardening.
- ✅ `ops-recovery` key login и аварийный sudo подтверждены после hardening.
- ✅ `sshd -T` показывает запрет root/password/keyboard-interactive login.
- ✅ Root key login отклоняется.
- ✅ UFW разрешает только 22/80/443; fail2ban и unattended upgrades активны.
- ✅ 2 GB swap активен и переживает reboot через `/etc/fstab`.
- ✅ Recovery private key подготовлен для отдельного offline-хранилища; консоль/rescue провайдера остаётся третьей линией.
- ✅ Секреты и приватные ключи не попали в Git.

## Порядок без локаута

`users + keys` → `оба новых login` → `sshd -t` → `reload` → `оба login повторно` → `root login отклонён` → `firewall`.

## Live evidence — 2026-09-19

- Daily key fingerprint: `SHA256:OYBK/Yjj0UVvr7zictSlkM2201vS8aGzo8pHvY8EcV0`.
- Recovery key fingerprint: `SHA256:HdbQkkdmMFTslw7rW5fejkbKCBCi5BuT18FzIdaHhXw`.
- `deploy` и `ops-recovery` вошли своими ключами до и после reload; `docker ps` и `sudo -n true` успешны.
- Root key login после reload отклонён: `Permission denied (publickey)`.
- Effective SSH: root/password/keyboard-interactive `no`, public key `yes`.
- UFW active, default deny incoming; разрешены только TCP 22/80/443 для IPv4/IPv6.
- fail2ban active/enabled, jail `sshd` active; unattended-upgrades active/enabled.
- Timezone `Europe/Minsk`; `/swapfile` 2 GB активен и добавлен в `/etc/fstab`.
- На сервере снаружи слушает только SSH; HTTP/HTTPS зарезервированы UFW для Caddy после deploy.
- Pending owner action: скопировать `volleytime-recovery` в независимое offline-хранилище и проверить fingerprint; до подтверждения статус остаётся `in_progress`.

## Не делать

- ❌ Не отключать root/password до проверки обоих новых ключей.
- ❌ Не использовать один private key для daily и recovery доступа.
- ❌ Не хранить private key или пароль в репозитории и server logs.
- ❌ Не закрывать текущую root-сессию до полного post-hardening smoke.
