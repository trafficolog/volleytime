# scripts/

## generate-github-issues.py

Генерирует GitHub Issues из task-карточек (`docs/tasks/*.md`).

```bash
# CSV для просмотра (все задачи MVP)
python scripts/generate-github-issues.py --format csv --release v0.1.0

# готовый bash-скрипт с gh issue create (MVP)
python scripts/generate-github-issues.py --format gh --release v0.1.0
bash issues.sh          # выполнить (нужен gh CLI + созданные milestones/labels)

# JSONL всех задач (для своих скриптов/API)
python scripts/generate-github-issues.py --format jsonl
```

Опции: `--format {jsonl,csv,gh}`, `--release vX.Y.Z` (фильтр), `--out FILE`.

Перед `bash issues.sh`: создать milestones и labels (см. `docs/GITHUB_SETUP.md`).
