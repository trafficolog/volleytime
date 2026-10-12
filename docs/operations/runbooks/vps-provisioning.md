# VPS Provisioning (Ubuntu 24.04)

## 1. Создание

- Провайдер: Selectel / Timeweb (Москва), 4 vCPU / 8 GB / 80 GB NVMe
- Ubuntu 24.04 LTS, записать IP

## 2. SSH + hardening

На новом/replacement VPS следовать [Task9.3.3](../../tasks/9-3-3-recovery-safe-ssh-access.md). На действующем VPS сначала read-only audit: provisioning не выполняется повторно вслепую.

1. Daily `deploy`, независимый `ops-recovery` с аварийным sudo, отдельный restricted CI ключ по [deploy runbook](deploy.md). Использовать разные ключи; recovery private key хранить вне daily системы, иметь консоль/rescue провайдера.
2. Создать пользователей, если они отсутствуют. Установить каталоги `.ssh`0700/`authorized_keys`0600 с правильными владельцами. Добавлять только соответствующие public keys, сохраняя существующие проверенные строки; не копировать root authorized_keys и не перезаписывать действующие daily/recovery/CI keys.
3. В новых отдельных сессиях проверить daily key login и Docker; recovery key login и `sudo -n true`. CI BatchMode проверить отдельно. При любом отказе не ужесточать SSH.
4. После успешных входов настроить drop-in: `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin no`, `PubkeyAuthentication yes`. Проверить `sshd -t` до reload; текущую рабочую root/console сессию сохранить.
5. Выполнить reload SSH, повторить оба положительных входа, проверить effective `sshd -T` и отрицательный root key login. Только затем закрыть исходную сессию и включать firewall.

Историческое подтверждение2026-09-19 в карточке не заменяет свежую проверку replacement host. Подтверждение отдельного offline storage владельцем остаётся самостоятельным checkpoint.

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

Ниже — исторический compose bootstrap, не текущий production release path. Для публикации готового проекта использовать [deploy runbook](deploy.md): verified runner-built images/Git bundle через Actions, без server-side git pull/build. Не выполнять следующие app `up` команды на действующем production.

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
