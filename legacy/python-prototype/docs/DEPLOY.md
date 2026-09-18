# Деплой

Варианты хостинга для production.

## Требования

Минимум:
- Linux-сервер (Ubuntu 22.04+ / Debian 12+)
- 1 vCPU, 512 MB RAM
- 5 GB диск
- HTTPS-домен (для приёма webhook от bePaid и от Telegram)

## Варианты хостинга

### Hetzner Cloud (рекомендация)

- **CX11**: 1 vCPU, 2 GB RAM, 20 GB диск — €4.51/мес
- Дата-центр в Германии или Финляндии
- Простой биллинг, оплата картой

Шаги:
1. Создать сервер с Ubuntu 22.04.
2. SSH, обновление пакетов.
3. Установить Docker + docker-compose.
4. Купить домен (например, `bot.example.by` за 20–30 BYN/год через hoster.by).
5. Настроить A-запись → IP сервера.
6. Поставить Caddy / Nginx с Let's Encrypt.
7. Развернуть проект (см. ниже).

### Railway

- Free tier ($5 кредитов/мес) → потом $5/мес.
- Деплой из GitHub.
- PostgreSQL встроен.
- HTTPS-домен `*.railway.app` бесплатно.

Минусы: оплата картой только западной.

### Fly.io

- Free allowance (3 VM × 256 MB).
- HTTPS бесплатно.
- Геораспределённые регионы.

Минусы: оплата только зарубежной картой.

### Свой VPS у белорусского хостера

- hoster.by, FlyHost, ActiveCloud.
- Цены 10–20 BYN/мес.
- Оплата с белорусской карты.

## Подготовка к prod (Фаза 6)

### Шаг 1. Миграции БД

```bash
pip install alembic
alembic init alembic
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

### Шаг 2. Переход на PostgreSQL

```bash
docker run -d --name pg \
  -e POSTGRES_USER=volley \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=volley \
  -p 127.0.0.1:5432:5432 \
  -v pg_data:/var/lib/postgresql/data \
  postgres:16

# В .env:
DATABASE_URL=postgresql+asyncpg://volley:secret@localhost:5432/volley
```

### Шаг 3. Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
CMD ["python", "-m", "src.bot.main"]
```

### Шаг 4. docker-compose.yml

```yaml
version: "3.9"
services:
  bot:
    build: .
    env_file: .env
    restart: unless-stopped
    depends_on: [postgres]
    ports:
      - "127.0.0.1:8080:8080"

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: volley
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: volley
    volumes:
      - pg_data:/var/lib/postgresql/data
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped

volumes:
  pg_data:
  caddy_data:
```

### Шаг 5. Caddyfile (HTTPS + reverse proxy)

```
bot.example.by {
    reverse_proxy bot:8080
}
```

### Шаг 6. Telegram webhook (вместо long polling)

```python
if settings.use_webhook:
    await bot.set_webhook(
        url=f"{settings.public_url}/telegram-webhook",
        secret_token=settings.tg_webhook_secret,
    )
```

### Шаг 7. Бэкапы БД

```bash
# /etc/cron.daily/pg-backup
#!/bin/bash
docker exec pg pg_dump -U volley volley | gzip > /backups/volley-$(date +%F).sql.gz
find /backups -name 'volley-*.sql.gz' -mtime +30 -delete
```

### Шаг 8. Мониторинг

- **UptimeRobot** (бесплатный) — пинг `/health` каждые 5 мин.
- **Sentry** (free tier 5k событий/мес) — алёрты об исключениях.

## Чек-лист развёртывания

- [ ] Сервер куплен и настроен
- [ ] Домен куплен, A-запись настроена
- [ ] `.env` со всеми секретами скопирован на сервер
- [ ] Публичный ключ bePaid `bepaid_public_key.pem` скопирован
- [ ] `docker-compose up -d` запущен
- [ ] `https://bot.example.by/health` возвращает 200
- [ ] В bePaid установлен notification_url
- [ ] Бэкап создаётся (проверить через сутки)
- [ ] Sentry / UptimeRobot настроены
- [ ] Сделан тестовый платёж

## Откат

```bash
docker-compose down
gunzip < /backups/volley-YYYY-MM-DD.sql.gz | docker exec -i pg psql -U volley volley
git checkout <previous-tag>
docker-compose up -d --build
```

## Стоимость владения

| Компонент | Стоимость |
|-----------|-----------|
| Hetzner CX11 | €4.51 / мес ≈ 15 BYN |
| Домен .by | 20–30 BYN / год |
| Telegram Bot API | бесплатно |
| Let's Encrypt | бесплатно |
| Sentry free tier | бесплатно |
| UptimeRobot | бесплатно |
| bePaid комиссия | ~2.5% с каждой транзакции |
| **Итого фикс** | **~18 BYN / мес** |

При 14 чел × 8 тренировок × 15 BYN = 1680 BYN/мес оборота → комиссии bePaid ≈ 42 BYN.
Полная стоимость инфраструктуры: ~60 BYN/мес.
