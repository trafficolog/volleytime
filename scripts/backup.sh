#!/usr/bin/env bash
# Ежедневный бэкап Postgres → S3 (cron: 0 4 * * *).
# Task 9.9.9: опциональное шифрование, проверка размера, пинг healthcheck.
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/volleytime/docker-compose.prod.yml}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="volleytime_${TIMESTAMP}.sql.gz"
TMP="/tmp/${BACKUP_FILE}"
RETENTION_DAYS="${RETENTION_DAYS:-21}"
MIN_SIZE_BYTES="${MIN_SIZE_BYTES:-10240}" # 10 КБ — дамп меньше означает сбой
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"

ping_healthcheck() { # $1 — суффикс (пусто = успех, /fail = ошибка)
  [ -n "$HEALTHCHECK_URL" ] || return 0
  curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}${1:-}" >/dev/null || true
}
fail() {
  echo "[backup] ОШИБКА: $1" >&2
  ping_healthcheck /fail
  exit 1
}
trap 'fail "неожиданное завершение"' ERR

echo "[backup] dumping database..."
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U volley volleytime | gzip > "${TMP}"

SIZE_BYTES=$(stat -c%s "${TMP}")
[ "${SIZE_BYTES}" -ge "${MIN_SIZE_BYTES}" ] || fail "дамп подозрительно мал (${SIZE_BYTES} байт)"
gzip -t "${TMP}" || fail "архив повреждён"
echo "[backup] dump ready: ${BACKUP_FILE} ($(du -h "${TMP}" | cut -f1))"

# Шифрование (age): ключ получателя в BACKUP_AGE_RECIPIENT.
# Приватный ключ хранится ОТДЕЛЬНО от бэкапов (см. runbook disaster-recovery).
UPLOAD="${TMP}"
UPLOAD_NAME="${BACKUP_FILE}"
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  command -v age >/dev/null || fail "BACKUP_AGE_RECIPIENT задан, но age не установлен"
  age -r "${BACKUP_AGE_RECIPIENT}" -o "${TMP}.age" "${TMP}"
  UPLOAD="${TMP}.age"
  UPLOAD_NAME="${BACKUP_FILE}.age"
  echo "[backup] encrypted with age"
else
  echo "[backup] ВНИМАНИЕ: BACKUP_AGE_RECIPIENT не задан — дамп уезжает в S3 без шифрования"
fi

echo "[backup] uploading to S3..."
aws --endpoint-url "${S3_ENDPOINT}" s3 cp "${UPLOAD}" "s3://${S3_BUCKET}/backups/${UPLOAD_NAME}"
rm -f "${TMP}" "${TMP}.age"
echo "[backup] uploaded."

# Ретенция: удалить бэкапы старше RETENTION_DAYS
CUTOFF=$(date -d "${RETENTION_DAYS} days ago" +%Y%m%d)
aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${S3_BUCKET}/backups/" | awk '{print $4}' | while read -r f; do
  [ -z "$f" ] && continue
  FILE_DATE=$(echo "$f" | grep -oE '[0-9]{8}' | head -1 || true)
  if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF" ]; then
    aws --endpoint-url "${S3_ENDPOINT}" s3 rm "s3://${S3_BUCKET}/backups/${f}"
    echo "[backup] pruned ${f}"
  fi
done

trap - ERR
ping_healthcheck
echo "[backup] done."
