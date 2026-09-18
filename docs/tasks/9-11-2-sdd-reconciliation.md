---
id: '9.11.2'
phase: '9'
epic: '9.11'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'SDD reconciliation completed: 119 legacy non-done MVP cards audited, 101 evidence-backed cards closed, 18 real open cards retained with exact reasons.'
roles:
  - DOCS
  - QA
  - DEVOPS
depends_on:
  - '9.11.1'
estimated_hours: '2-4'
tags:
  - sdd
  - reconciliation
  - release
---

# Task 9.11.2: SDD reconciliation перед v0.1.3

## Цель

Устранить исторический status drift в R0/MVP task cards без механического массового закрытия и отделить реально незавершённые acceptance criteria от уже закрытых review findings.

## Что должно быть сделано

1. Аудировать все non-done cards фаз 3/4/5/6/8/9.
2. Закрывать карточку только при наличии evidence из кода, review-fix epic и свежего CI/review.
3. Не закрывать manual/external acceptance criteria без фактического подтверждения.
4. Для реально открытых карточек заменить устаревший status_note на точную текущую причину.
5. Обновить current-state, release-readiness review и R0.3 status.

## Критерии приёмки

- ✅ Исходные 119 non-done cards сверены поштучно/по доказуемым группам.
- ✅ 101 историческая карточка переведена в done только после evidence-backed reconciliation.
- ✅ 18 реально открытых карточек сохранены в in_progress с конкретными remaining criteria.
- ✅ Дублирующий manual Telegram gate 8.7.2/8.8.11 явно обозначен как один underlying gate.
- ✅ Phase 9 external gates не объявлены выполненными.
- ✅ Repository gaps 4.7.5, 9.8.2 и 9.8.3 явно отделены от external validation.
- ✅ Product/runtime code не менялся.
