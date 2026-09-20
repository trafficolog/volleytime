---
id: '9.3.5'
phase: '9'
epic: '9.3'
status: done
sync_state: synced
last_reviewed: 2026-09-20
status_note: 'Live packet capture proved that no webhook packets from the official Telegram IPv4 ranges reach the VPS while Telegram records fresh timeouts; the direct IPv4 path is external to the host and the fallback fix is split into Task 9.3.6.'
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

# Task 9.3.5: Диагностика Telegram webhook ingress по IPv4

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

## Диагностика

1. UFW active, default deny incoming, но TCP 80/443 разрешены для IPv4 и IPv6.
2. nftables/Docker DNAT направляет публичные 80/443 в Caddy; `DOCKER-USER` не содержит дополнительных блокировок.
3. fail2ban содержит только jail `sshd`, список текущих banned IP пуст.
4. Caddy и bot принимают корректно подписанный контрольный webhook POST с HTTP 200 примерно за 40 мс.
5. Повторный `setWebhook` с тем же URL и `drop_pending_updates=false` принят Telegram, после чего `getWebhookInfo` снова показал свежий `Connection timed out`, а очередь выросла до четырёх updates.
6. Ограниченный 300-секундный `tcpdump` на публичном `ens3` во время подтверждённого Telegram retry дал `0 packets captured`, `0 packets received by filter`, `0 packets dropped by kernel` для source ranges `149.154.160.0/20` и `91.108.4.0/22`, TCP dst port 443.
7. На Volley Time VPS и production TG Digest Agent исходящий Telegram IPv4 также завершается timeout, тогда как конкретный Telegram IPv6 отвечает. TG Digest Agent работает по исходящей схеме: MTProto через proxy pool и Bot API через исходящие запросы; входящий webhook он не использует.

## Вывод

Прямой IPv4-маршрут между Telegram и хостинг-провайдером не работает в обоих направлениях. Пакеты Telegram не достигают интерфейса VPS, поэтому UFW, Docker, Caddy и приложение не являются местом исправления. Telegram webhook поддерживает только IPv4; рабочий IPv6 egress не может исправить ingress.

Для малонагруженного пилота согласован отдельный fallback Task 9.3.6: переключить production bot на уже реализованный outbound polling через рабочий IPv6, не удаляя webhook-код и не сбрасывая pending updates. Целевой webhook-режим возвращается после исправления IPv4-маршрута провайдером.

## Критерии приёмки

- [x] Root cause ingress timeout подтверждён наблюдаемыми сетевыми данными, а не предположением.
- [x] UFW, nftables/Docker DNAT и fail2ban проверены без ослабления SSH или публикации внутренних портов bot/web.
- [x] Во время свежего Telegram timeout capture на публичном интерфейсе не получил ни одного пакета из официальных webhook ranges.
- [x] Локальный webhook endpoint подтверждён корректно подписанным контрольным POST.
- [x] `/api/health`, bot `/healthz`, Caddy и release identity остались healthy.
- [x] Диагноз отделён от fallback-исправления Task 9.3.6.
- [x] Секретный webhook path, secret token и bot token не попали в task evidence.

## Не делать

- Не добавлять AAAA как средство исправления Telegram webhook ingress: Telegram webhook работает по IPv4.
- Не переключать production на polling внутри этой диагностической задачи; fallback оформляется Task 9.3.6.
- Не открывать bot-порты 8443/3001 напрямую наружу.
- Не отключать UFW/fail2ban целиком и не расширять SSH-доступ.
- Не использовать и не выводить прежний root-пароль после его ротации.
