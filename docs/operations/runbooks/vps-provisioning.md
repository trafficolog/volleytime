# VPS Provisioning (Ubuntu 24.04)

## 1. Создание

- Провайдер: Selectel / Timeweb (Москва), 4 vCPU / 8 GB / 80 GB NVMe
- Ubuntu 24.04 LTS, записать IP

## 2. SSH + hardening

Используются два разных ключа и две учётные записи:

- `deploy` — ежедневный deploy, доступ к Docker и `/opt/volleytime`;
- `ops-recovery` — независимый аварийный ключ с `sudo`, который после настройки хранится отдельно от daily key.

```bash
# Сначала пользователи и разные public keys, затем две новые SSH-сессии.
useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy
useradd --create-home --shell /bin/bash ops-recovery
usermod -aG sudo ops-recovery

install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -m 600 -o deploy -g deploy /dev/stdin /home/deploy/.ssh/authorized_keys
install -d -m 700 -o ops-recovery -g ops-recovery /home/ops-recovery/.ssh
install -m 600 -o ops-recovery -g ops-recovery /dev/stdin /home/ops-recovery/.ssh/authorized_keys
```

Проверить `deploy` key login + `docker ps` и отдельно `ops-recovery` key login + `sudo -n true`. Только после этого создать drop-in:

```bash
cat >/etc/ssh/sshd_config.d/90-production-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
EOF

sshd -t
systemctl reload ssh
```

После reload повторить оба новых входа, убедиться через `sshd -T` в effective settings и проверить, что root key login отклонён. Текущую root-сессию закрывать последней. Консоль/rescue провайдера остаётся третьей линией восстановления.

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
