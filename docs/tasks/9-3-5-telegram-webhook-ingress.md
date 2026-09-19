---
id: '9.3.5'
phase: '9'
epic: '9.3'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Telegram getWebhookInfo reports a fresh connection timeout and one pending update although the production webhook answers a secret-authenticated control POST with HTTP 200 in about 40 ms.'
roles:
  - DEVOPS
  - QA
  - SECURITY
depends_on:
  - '9.3.4'
  - '9.5.1'
estimated_hours: '2'
tags:
  - telegram
  - webhook
  - ipv4
  - firewall
  - production
---

# Task 9.3.5: Telegram webhook ingress по IPv4

## Дефект

Production bot регистрирует webhook и отвечает на корректно подписанный контрольный POST через Caddy, однако Telegram не доставляет реальный update: `getWebhookInfo` показывает один pending update и свежий `Connection timed out`.

Telegram принимает webhook только по IPv4. Домен `volleytime.by` указывает A-записью на `185.185.69.136`; добавление AAAA не исправит ingress. Исходящий доступ bot-контейнера к Telegram API по IPv6 из Task 9.3.4 является отдельным направлением трафика.

## Подтверждённые факты

- `https://volleytime.by/api/health` доступен снаружи и показывает ожидаемый release SHA.
- Caddy принимает HTTPS на домене, а production webhook с правильным secret token возвращает HTTP 200 примерно за 40 мс.
- Bot healthy, webhook mode активен, URL webhook зарегистрирован с `ip_address=185.185.69.136`.
- `getWebhookInfo` показывает `pending_update_count=1` и свежий `last_error_message=Connection timed out`.
- Официально опубликованные Telegram source ranges для webhook: `149.154.160.0/20` и `91.108.4.0/22`; поддерживаемые порты: 443, 80, 88 и 8443.
- После ротации root-пароля VPS перезагрузился около 23:45 MSK и автоматически восстановил healthy production-контейнеры; причина перезагрузки провайдером не подтверждена.

## План диагностики и исправления

1. Зафиксировать текущие UFW/nftables/provider-firewall правила без вывода секретов.
2. Проверить, достигают ли TCP/HTTPS-запросы от опубликованных Telegram IPv4 ranges интерфейса VPS и Caddy.
3. Проверить отсутствие блокировки в fail2ban, reverse proxy и hosting firewall.
4. Применить минимальное исправление в установленном слое; для репозиторного изменения сначала добавить падающий contract test.
5. Повторно зарегистрировать тот же webhook только если это нужно для проверки, не сбрасывая pending updates.
6. Подтвердить доставку реального Telegram update и отсутствие нового timeout.

## Критерии приёмки

- [ ] Root cause ingress timeout подтверждён наблюдаемыми сетевыми данными, а не предположением.
- [ ] Порт 443 доступен для Telegram webhook source ranges без ослабления SSH или публикации внутренних портов bot/web.
- [ ] `pending_update_count` очищается, а `last_error_date` перестаёт обновляться.
- [ ] Реальный update из Telegram достигает bot handler и обрабатывается один раз.
- [ ] `/api/health`, bot `/healthz`, Caddy и release identity остаются healthy.
- [ ] Все репозиторные изменения проходят RED -> GREEN и применимые пять gates.
- [ ] Секретный webhook path, secret token и bot token не попадают в логи или task evidence.

## Не делать

- Не добавлять AAAA как средство исправления Telegram webhook ingress: Telegram webhook работает по IPv4.
- Не переключать production на polling и не добавлять внешний proxy/CDN без отдельного архитектурного решения.
- Не открывать bot-порты 8443/3001 напрямую наружу.
- Не отключать UFW/fail2ban целиком и не расширять SSH-доступ.
- Не использовать и не выводить прежний root-пароль после его ротации.
