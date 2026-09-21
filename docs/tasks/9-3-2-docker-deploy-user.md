---
id: '9.3.2'
phase: '9'
epic: '9.3'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Docker/Compose, non-root deploy access, root/password SSH disablement, /opt/volleytime ownership and the provisioning runbook are verified on the production VPS.'
roles:
  - DEVOPS
depends_on:
  - '9.3.1'
estimated_hours: '1-2'
tags:
  - docker
  - vps
  - infra
---

# Task 9.3.2: Docker install + deploy-пользователь + provisioning doc

## Цель

Установить Docker + compose-plugin. Создать не-root deploy-пользователя (в docker группе). Задокументировать провижининг для повторяемости.

## Контекст

Деплой работает под не-root пользователем (безопасность). Docker для контейнеров. Документация провижининга — чтобы пересоздать VPS воспроизводимо.

## Что должно быть сделано

1. **Docker install (официальный способ):**

   ```bash
   curl -fsSL https://get.docker.com | sh
   # или официальный репозиторий Docker (apt)
   docker --version
   docker compose version
   ```

2. **Deploy-пользователь:**

   ```bash
   adduser deploy
   usermod -aG docker deploy
   # SSH-ключ для deploy
   mkdir -p /home/deploy/.ssh
   cp ~/.ssh/authorized_keys /home/deploy/.ssh/
   chown -R deploy:deploy /home/deploy/.ssh
   chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
   ```

   Проверить вход: `ssh deploy@<VPS_IP>`, `docker ps` (без sudo).

3. **После проверки deploy-входа — отключить root SSH** (завершение 9.3.1):

   ```
   # /etc/ssh/sshd_config
   PermitRootLogin no
   ```

   `systemctl restart sshd`

4. **Директория деплоя:**

   ```bash
   sudo mkdir -p /opt/volleytime
   sudo chown deploy:deploy /opt/volleytime
   # сюда: docker-compose.prod.yml, Caddyfile, .env
   ```

5. **Provisioning doc** `docs/operations/runbooks/vps-provisioning.md`:
   - Шаги создания VPS (провайдер, образ, размер)
   - SSH/firewall/fail2ban (9.3.1)
   - Docker + deploy-юзер (9.3.2)
   - Чеклист повторяемости
   - Что в GitHub Secrets, что на сервере

## Критерии приёмки

- ✅ Docker + compose-plugin установлены
- ✅ deploy-пользователь создан, в docker группе
- ✅ deploy входит по SSH-ключу, docker без sudo
- ✅ root SSH отключён (после проверки deploy)
- ✅ /opt/volleytime для деплоя (owned by deploy)
- ✅ Provisioning runbook задокументирован

## Подсказки

- **deploy в docker группе** = docker без sudo. Удобно для CI/CD (9.8 SSH-деплой под deploy).
- **Проверить deploy-вход ДО отключения root** — порядок из 9.3.1.
- **Provisioning doc** — если VPS умрёт/мигрируешь, воспроизведёшь за полчаса. Не полагаться на память.
- **get.docker.com** — официальный скрипт, ставит свежий Docker + compose.

## Не делать

- ❌ Не деплоить под root
- ❌ Не отключать root до проверки deploy-входа
- ❌ Не давать deploy sudo без необходимости (docker группы хватает)
- ❌ Не пропускать provisioning doc

## Production evidence — 2026-09-21

- Normal, recovery and restricted CI keys authenticate independently as non-root `deploy`; Docker commands run without sudo.
- `/opt/volleytime` is the active deploy root owned for `deploy` operations; root and password SSH authentication were disabled only after alternate key access was verified.
- The production stack has completed repeated bundle deployments and a controlled rollback under `deploy`.
