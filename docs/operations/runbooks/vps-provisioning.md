# VPS Provisioning (Ubuntu 24.04)

## 1. Создание

- Провайдер: Selectel / Timeweb (Москва), 4 vCPU / 8 GB / 80 GB NVMe
- Ubuntu 24.04 LTS, записать IP

## 2. SSH + hardening

```bash
ssh-copy-id root@<IP>           # с локальной машины
# на сервере:
adduser deploy && usermod -aG docker deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
```

Проверить вход `ssh deploy@<IP>` → только потом:

```bash
# /etc/ssh/sshd_config
PasswordAuthentication no
PermitRootLogin no
systemctl restart sshd
```

> ⚠️ Не отключать root до проверки входа deploy — иначе локаут.

## 3. Firewall + fail2ban

```bash
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
apt install -y fail2ban && systemctl enable --now fail2ban
apt install -y unattended-upgrades
```

## 4. Docker

```bash
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/volleytime && chown deploy:deploy /opt/volleytime
```

## 5. Файлы приложения

Скопировать в `/opt/volleytime`: `docker-compose.prod.yml`, `Caddyfile`, `.env` (из `.env.prod.example`, chmod 600).

## 6. DNS + BotFather

- A-запись `volleytime.by` → IP VPS
- BotFather: `/setdomain` → volleytime.by, Menu Button → `https://volleytime.by/m/`

> Без Mini App domain в BotFather web_app кнопки не откроются.

## 7. Первый запуск

```bash
cd /opt/volleytime
docker compose -f docker-compose.prod.yml up -d postgres   # дождаться healthy
docker compose -f docker-compose.prod.yml up -d
curl -fsS https://volleytime.by/api/health
```

## 8. Бэкапы (cron под deploy)

```
0 4 * * * /opt/volleytime/scripts/backup.sh >> /var/log/vt-backup.log 2>&1
```

После настройки — **обязательно** прогнать `scripts/restore-test.sh`.

## 9. GitHub Secrets (для CI/CD)

`VPS_HOST`, `VPS_SSH_KEY`, `DOMAIN` — деплой из Actions (`.github/workflows/deploy.yml`).
