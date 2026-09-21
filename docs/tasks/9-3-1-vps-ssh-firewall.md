---
id: '9.3.1'
phase: '9'
epic: '9.3'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Independent audit passed SSH/recovery access, firewall, fail2ban and timezone checks; Task 9.3.7 repaired and dry-run verified unattended-upgrades.'
roles:
  - DEVOPS
depends_on: []
estimated_hours: '1-2'
tags:
  - vps
  - security
  - infra
---

# Task 9.3.1: VPS создание + SSH + firewall + hardening

## Цель

Создать VPS (Selectel/Timeweb, Москва, Ubuntu 24.04). Настроить SSH по ключу, отключить пароль/root логин, ufw firewall, fail2ban, авто-обновления.

## Контекст

DEPLOY.md: Selectel/Timeweb, Москва, 2-4 vCPU / 4-8 GB. Сервер в интернете — базовая безопасность обязательна (SSH-брутфорс реален).

## Что должно быть сделано

1. **Создать VPS:**
   - Провайдер: Selectel или Timeweb (финальный выбор по тестовому аккаунту — открытый вопрос DEPLOY.md)
   - Поддерживаемая Ubuntu LTS; production VPS фактически работает на Ubuntu 26.04 LTS в московском регионе
   - Записать IP, root-доступ начальный

2. **SSH по ключу:**

   ```bash
   # локально: сгенерировать ключ если нет
   ssh-keygen -t ed25519 -C "volleytime-deploy"
   # скопировать на сервер
   ssh-copy-id root@<VPS_IP>
   ```

3. **Hardening SSH** (`/etc/ssh/sshd_config`):

   ```
   PasswordAuthentication no
   PermitRootLogin no          # после создания deploy-юзера (9.3.2)
   PubkeyAuthentication yes
   ```

   ```bash
   systemctl restart sshd
   ```

   ВАЖНО: сначала создать deploy-юзера с ключом (9.3.2) и проверить вход, ПОТОМ отключать root (иначе локаут).

4. **ufw firewall:**

   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow 22/tcp     # SSH
   ufw allow 80/tcp     # HTTP (Caddy редирект)
   ufw allow 443/tcp    # HTTPS
   ufw enable
   ```

5. **fail2ban** (SSH-брутфорс):

   ```bash
   apt install fail2ban
   # /etc/fail2ban/jail.local — sshd jail (дефолт обычно ок)
   systemctl enable --now fail2ban
   ```

6. **Авто-обновления безопасности:**

   ```bash
   apt install unattended-upgrades
   dpkg-reconfigure -plow unattended-upgrades
   ```

7. **Базовое:** timezone (Europe/Moscow), swap если RAM мало, обновить систему (`apt update && apt upgrade`).

## Критерии приёмки

- [x] VPS создан (поддерживаемая Ubuntu LTS, Москва).
- [x] Основной и recovery SSH-ключи работают для непривилегированного `deploy`.
- [x] Пароль-логин и root SSH login отключены.
- [x] UFW разрешает только 22, 80, 443 с default deny incoming; внутренние application/database порты снаружи закрыты.
- [x] fail2ban активен, включён и содержит SSH jail.
- [x] Авто-обновления безопасности имеют валидную конфигурацию и проходят dry-run (Task 9.3.7).
- [x] Timezone `Europe/Moscow`, NTP включён и синхронизирован.

## Independent audit — 2026-09-21

- Main и recovery credentials независимо вошли как `deploy`; root login с основным ключом получил `Permission denied (publickey)`.
- SSH configuration files задают `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PubkeyAuthentication yes` и ранний `PermitRootLogin no`; успешного root login нет.
- Root audit artifact подтвердил активный UFW с default deny incoming и allow только 22/80/443 для IPv4/IPv6; свежие внешние TCP probes подтвердили 22/80/443 open и 3000/3001/5432/8443 closed.
- fail2ban `active`/`enabled`; root artifact содержит единственный jail `sshd`, 221 failed attempts и 13 historical bans на момент снимка.
- `apt-daily-upgrade.timer` active/enabled и пакет `unattended-upgrades` установлен, но `apt-config dump` стабильно завершается ошибкой `Syntax error /etc/apt/apt.conf.d/20auto-upgrades:1: Extra junk after value`.
- Byte-level inspection показал literal backslashes вместо кавычек: `\ 1\;` и `\1\;`; package reference содержит корректные строки с `"1"`. Root cause — повреждённое содержимое `/etc/apt/apt.conf.d/20auto-upgrades`, а не timer или пакет.
- `timedatectl` сообщает `Europe/Moscow`, `NTP=yes`, `NTPSynchronized=yes`. Публично слушают только SSH и Caddy HTTP/HTTPS; web, bot и PostgreSQL не публикуют внутренние порты.
- Task 9.3.7 сохранила root-only backup, атомарно восстановила package-reference config и получила GREEN parser/reference/timer/root dry-run evidence без reboot или изменения application runtime.

## Подсказки

- **Порядок hardening критичен:** НЕ отключать root/пароль до проверки альтернативного входа (ключ + deploy-юзер 9.3.2). Иначе локаут — только через консоль провайдера восстанавливать.
- **Держать вторую SSH-сессию открытой** при изменении sshd_config — если сломал, есть откат.
- **fail2ban обязателен** — SSH-брутфорс начнётся через минуты после поднятия сервера.
- **Выбор провайдера** — по тестовому аккаунту (скорость, UI, S3 рядом). Selectel надёжнее, Timeweb дешевле.

## Не делать

- ❌ Не отключать root до проверки deploy-юзера (локаут)
- ❌ Не оставлять пароль-логин
- ❌ Не открывать лишние порты (postgres/internal не нужны снаружи)
- ❌ Не пропускать fail2ban
