---
id: '9.3'
phase: '9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'VPS Ubuntu 24.04, SSH, firewall, Docker, базовый hardening.'
estimated_hours: '2-4'
depends_on: ['9.2']
---

# Epic 9.3: VPS provisioning (SSH, firewall, Docker, hardening)

**Цель.** Подготовить VPS (Selectel/Timeweb, Москва): Ubuntu 24.04, SSH-ключи, firewall (ufw), Docker + compose, базовый hardening.

## Контекст

DEPLOY.md: Selectel/Timeweb, Москва, 2-4 vCPU / 4-8 GB. Финальный выбор провайдера — по тестовому аккаунту (открытый вопрос). Базовая безопасность обязательна (сервер в интернете).

## Definition of Done

- VPS создан (Ubuntu 24.04, Москва, 4 vCPU / 8 GB рекомендуется)
- SSH по ключу, пароль-логин отключён, root-логин отключён
- ufw firewall: только 22 (SSH), 80, 443 открыты
- Docker + docker-compose-plugin установлены
- Не-root пользователь для деплоя (в docker группе)
- Базовый hardening: fail2ban (SSH), авто-обновления безопасности
- Документирован провижининг (повторяемость)

## Задачи

| ID    | Задача                                                  | Часов |
| ----- | ------------------------------------------------------- | ----: |
| 9.3.1 | VPS создание + SSH + firewall + hardening               |   1-2 |
| 9.3.2 | Docker install + deploy-пользователь + provisioning doc |   1-2 |

## Не делать

- ❌ Не оставлять пароль-логин/root SSH
- ❌ Не открывать лишние порты
- ❌ Не работать под root для деплоя
- ❌ Не пропускать fail2ban (SSH-брутфорс реален)
