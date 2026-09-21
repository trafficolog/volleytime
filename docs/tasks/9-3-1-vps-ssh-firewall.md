---
id: '9.3.1'
phase: '9'
epic: '9.3'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Production VPS and key-only non-root SSH are live; the card remains open because the full ufw, unattended-upgrades and timezone checklist was not independently re-audited in this release.'
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
   - Ubuntu 24.04 LTS, Москва, рекомендуется 4 vCPU / 8 GB / 80 GB NVMe
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

- ✅ VPS создан (Ubuntu 24.04, Москва)
- ✅ SSH по ключу работает
- ✅ Пароль-логин отключён (после проверки ключа)
- ✅ ufw: только 22, 80, 443 (default deny incoming)
- ✅ fail2ban активен (SSH jail)
- ✅ Авто-обновления безопасности включены
- ✅ Timezone Europe/Moscow

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
