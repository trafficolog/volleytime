# 🚢 Deploy Guide

> **Last updated:** 2026-05-25
> Руководство по развёртыванию Volley Time на production. Финализируется в Phase 9, здесь — стратегические решения.

---

## TL;DR

- **Hosting:** российский VPS (Selectel или Timeweb Cloud)
- **OS:** Ubuntu 24.04 LTS
- **Reverse proxy:** Caddy (auto HTTPS через Let's Encrypt)
- **Apps:** Docker + docker-compose
- **DB:** PostgreSQL в Docker (managed позже)
- **Backup:** ежедневный pg_dump → S3 (Selectel Object Storage)
- **Monitoring:** Sentry + UptimeRobot
- **CI/CD:** GitHub Actions → deploy via SSH
- **Domain:** volleytime.by

---

## Выбор провайдера VPS

См. также [../architecture/STACK_DECISIONS.md](../architecture/STACK_DECISIONS.md#hosting-российский-vps-phase-9).

### Кандидаты

| Провайдер         | Плюсы                                                            | Минусы               | Стартовая цена |
| ----------------- | ---------------------------------------------------------------- | -------------------- | -------------- |
| **Selectel**      | Крупный, надёжный, дата-центры в Москве/СПб, своё Object Storage | Чуть дороже          | от 250 ₽/мес   |
| **Timeweb Cloud** | Простой UI, дешёвый, есть S3                                     | Меньше features      | от 200 ₽/мес   |
| **RUVDS**         | Хорошее SLA, широкая география                                   | UI попроще           | от 220 ₽/мес   |
| **Beget**         | Простая админка                                                  | Меньше cloud-функций | от 200 ₽/мес   |

### Рекомендуемая конфигурация для MVP (Phase 9-10)

- **CPU:** 2-4 vCPU
- **RAM:** 4-8 GB
- **Disk:** 60-100 GB NVMe SSD
- **Регион:** Москва (близко к Telegram API)
- **OS:** Ubuntu 24.04 LTS

Ориентир: **~700-1500 ₽/мес** на MVP-объёме.

### Что важно при выборе

- Поддержка Docker
- Доступ к консоли через SSH
- Снапшоты (для бэкапа всего диска)
- Object Storage поблизости (для бэкапов БД)
- Простая поддержка (на русском)

---

## Архитектура deployment

```
                       ┌───────────────────┐
                       │   Российский VPS  │
                       │   Ubuntu 24.04    │
                       └─────────┬─────────┘
                                 │
            ┌────────────────────┼───────────────────┐
            │                    │                   │
       ┌────▼────┐         ┌─────▼─────┐       ┌─────▼─────┐
       │  Caddy  │  proxy  │ apps/web  │       │ apps/bot  │
       │  :443   │────────►│  :3000    │       │ (long-poll│
       │  :80    │         │  (Nuxt 4) │       │  webhook) │
       └─────────┘         └─────┬─────┘       └─────┬─────┘
                                 │                   │
                                 └─────────┬─────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │ PostgreSQL :5432 │
                                  │ Redis :6379      │
                                  └──────────────────┘
                                           │
                                           ▼
                          ┌──────────────────────────┐
                          │ Selectel Object Storage  │
                          │ (backups, evidence)      │
                          └──────────────────────────┘
```

---

## Initial setup (Phase 9)

### 1. Provision VPS

```bash
# Через UI провайдера:
- Создать VPS 4 vCPU / 8 GB / 80 GB NVMe
- Регион: Москва
- OS: Ubuntu 24.04 LTS
- SSH-ключ загружен

# После создания:
ssh root@<vps_ip>
adduser deploy
usermod -aG sudo,docker deploy
ssh-copy-id deploy@<vps_ip>
```

### 2. Firewall

```bash
# UFW: разрешить только SSH, HTTP, HTTPS
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable
```

### 3. Установка Docker

```bash
# Стандартный install Docker CE
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

### 4. DNS

```
# У регистратора volleytime.by:
A   volleytime.by         → <vps_ip>
A   www.volleytime.by     → <vps_ip>
A   app.volleytime.by     → <vps_ip>  (опционально)
A   api.volleytime.by     → <vps_ip>  (опционально)
```

### 5. Caddyfile (HTTPS)

```caddyfile
volleytime.by, www.volleytime.by {
    reverse_proxy localhost:3000
    encode gzip
}

# Логи
volleytime.by {
    log {
        output file /var/log/caddy/volleytime.log
    }
}
```

Caddy автоматически получит сертификаты от Let's Encrypt.

### 6. Deploy

```bash
# Через GitHub Actions или вручную:
ssh deploy@<vps_ip>
cd /opt/volleytime
git pull
docker compose pull
docker compose up -d
```

---

## docker-compose.prod.yml (черновик для Phase 9)

```yaml
version: '3.9'

services:
  web:
    image: ghcr.io/<owner>/volleytime-web:latest
    restart: always
    environment:
      DATABASE_URL: postgresql://volleytime:${POSTGRES_PASSWORD}@db:5432/volleytime
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      EMAIL_API_KEY: ${EMAIL_API_KEY}
      SENTRY_DSN: ${SENTRY_DSN}
    depends_on:
      - db
      - redis
    ports:
      - '3000:3000'

  bot:
    image: ghcr.io/<owner>/volleytime-bot:latest
    restart: always
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      DATABASE_URL: postgresql://volleytime:${POSTGRES_PASSWORD}@db:5432/volleytime
      WEB_URL: https://volleytime.by
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: volleytime
      POSTGRES_USER: volleytime
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - '127.0.0.1:5432:5432' # только localhost

  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - '127.0.0.1:6379:6379'
    volumes:
      - redis_data:/data

  caddy:
    image: caddy:2-alpine
    restart: always
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

---

## Бэкапы

### Daily backup (cron job)

```bash
#!/bin/bash
# /opt/volleytime/scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR=/var/backups/postgres
mkdir -p $BACKUP_DIR

docker compose exec -T db pg_dump -U volleytime volleytime | gzip > $BACKUP_DIR/volleytime_$DATE.sql.gz

# Upload to Selectel Object Storage (s3cmd или mc)
mc cp $BACKUP_DIR/volleytime_$DATE.sql.gz selectel/volleytime-backups/

# Удалить локальные файлы старше 7 дней
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Cron:

```
0 3 * * * /opt/volleytime/scripts/backup.sh
```

### Что должно быть в бэкапе

- PostgreSQL dump (структура + данные)
- Не нужно: Redis (cache, восстанавливается)
- Не нужно: код (в git)
- Опционально: Object Storage evidence (зависит от объёма)

### Тест восстановления

**Раз в месяц** — тест:

1. Поднять staging-окружение из последнего бэкапа.
2. Запустить smoke-тесты.
3. Убедиться что Mini App работает.

Без regular тестов бэкап = «надеюсь работает».

---

## Monitoring

### Sentry (Phase 9)

- web app: интеграция через `@sentry/nuxt`
- bot: интеграция через `@sentry/node`
- Free tier: 5K events/мес — хватит на MVP

### UptimeRobot (Phase 9)

- HTTP check на `https://volleytime.by/health` каждые 5 мин
- Telegram-alert если down
- Free tier: 50 мониторов

### Self-hosted альтернативы (Phase 14+)

Если объёмы вырастут:

- **GlitchTip** вместо Sentry (Docker, self-hosted)
- **UptimeKuma** вместо UptimeRobot (Docker, self-hosted)
- **Loki + Grafana** для логов
- **Prometheus** для метрик

---

## CI/CD (Phase 9)

### GitHub Actions workflow

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
      - run: pnpm typecheck

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t ghcr.io/${{ github.repository }}-web -f apps/web/Dockerfile .
      - run: docker build -t ghcr.io/${{ github.repository }}-bot -f apps/bot/Dockerfile .
      - run: docker push ghcr.io/${{ github.repository }}-web
      - run: docker push ghcr.io/${{ github.repository }}-bot

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: deploy
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/volleytime
            docker compose pull
            docker compose up -d
            docker compose exec web pnpm db:migrate
```

---

## Telegram webhook

В production используем **webhook**, не long-polling:

```bash
# При первом deploy установить webhook
curl -F "url=https://volleytime.by/webhooks/telegram" \
  https://api.telegram.org/bot<TOKEN>/setWebhook
```

В коде webhook принимается через `apps/web/server/routes/webhooks/telegram.post.ts`.

---

## Безопасность production

### Что обязательно

- ✅ SSH только по ключу (отключить password auth)
- ✅ Firewall (UFW): только 22, 80, 443
- ✅ HTTPS обязательно (Caddy auto)
- ✅ Все секреты в `.env` (не в Git)
- ✅ Регулярные обновления: `apt-get update && apt-get upgrade` раз в неделю
- ✅ Docker secrets для production-credentials (Phase 14+)
- ✅ Rate limiting на auth endpoints (better-auth даёт)
- ✅ CSRF protection (better-auth даёт)
- ✅ HMAC валидация Telegram webhook

### Что желательно

- 🔵 Fail2ban для SSH bruteforce
- 🔵 Cloudflare перед Caddy (бесплатный DDoS protection)
- 🔵 IP allowlist для admin-routes
- 🔵 Audit log всех изменений (есть в DOMAIN.md)

---

## Disaster recovery

### Сценарий: VPS upal

1. Создать новый VPS.
2. Установить Docker + Caddy.
3. Скачать последний backup из Object Storage.
4. `pg_restore` → новый Postgres контейнер.
5. `docker compose up -d`.
6. Указать DNS на новый IP.

**Целевое RTO:** 4 часа.
**Целевое RPO:** 24 часа (последний бэкап).

### Сценарий: БД повреждена

1. Остановить web и bot.
2. Восстановить из последнего рабочего backup.
3. Запустить.
4. Уведомить пользователей об инциденте.

---

## Юридические аспекты (Phase 9-10)

### ФЗ-152 (РФ, персональные данные)

Если на платформе есть пользователи-резиденты РФ:

- ✅ Хранение PII на серверах в РФ (наш VPS — в РФ)
- ✅ Согласие пользователя при регистрации (через UI)
- ✅ Возможность экспорта своих данных
- ✅ Возможность удаления аккаунта

### Регистрация ИП / самозанятость

- См. [TAXES.md](./TAXES.md) для налоговых аспектов РБ и РФ
- Решение «РБ vs РФ» — по результатам Phase 10

---

## Открытые вопросы

1. **Cloudflare CDN или нет?** Phase 11+ — если будут проблемы со скоростью или DDoS.
2. **Multi-region deploy?** Не на старте, только если private beta потребует.
3. **Managed PostgreSQL?** Phase 14+, когда DBA-работа станет проблемой.
4. **Container registry?** GitHub Container Registry (бесплатно для public, $0.25/GB для private).

---

## Ссылки

- [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- [../architecture/STACK_DECISIONS.md](../architecture/STACK_DECISIONS.md)
- [../phases/9-production-deploy.md](../phases/9-production-deploy.md)
- [TAXES.md](./TAXES.md)
