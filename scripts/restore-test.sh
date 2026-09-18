#!/usr/bin/env bash
# Тест восстановления: скачать последний бэкап → развернуть в temp-БД → проверить.
# Task 9.9.9: ON_ERROR_STOP, ожидание готовности БД, проверка таблиц, пинг healthcheck.
set -euo pipefail

HEALTHCHECK_URL="${HEALTHCHECK_RESTORE_URL:-}"
ping_healthcheck() {
  [ -n "$HEALTHCHECK_URL" ] || return 0
  curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}${1:-}" >/dev/null || true
}
cleanup() {
  docker rm -f vt_restore_test >/dev/null 2>&1 || true
  rm -f /tmp/restore-test.sql.gz /tmp/restore-test.sql.gz.age
}
fail() {
  echo "[restore-test] ОШИБКА: $1" >&2
  cleanup
  ping_healthcheck /fail
  exit 1
}

echo "[restore-test] fetching latest backup..."
LATEST=$(aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${S3_BUCKET}/backups/" | sort | tail -1 | awk '{print $4}')
[ -n "$LATEST" ] || fail "бэкапы не найдены"
aws --endpoint-url "${S3_ENDPOINT}" s3 cp "s3://${S3_BUCKET}/backups/${LATEST}" "/tmp/${LATEST}" || fail "не удалось скачать ${LATEST}"

DUMP="/tmp/${LATEST}"
if [[ "$LATEST" == *.age ]]; then
  [ -n "${BACKUP_AGE_KEY_FILE:-}" ] || fail "бэкап зашифрован, но BACKUP_AGE_KEY_FILE не задан"
  age -d -i "${BACKUP_AGE_KEY_FILE}" -o /tmp/restore-test.sql.gz "$DUMP" || fail "не удалось расшифровать"
  DUMP=/tmp/restore-test.sql.gz
fi
gzip -t "$DUMP" || fail "архив повреждён"

echo "[restore-test] starting temp postgres..."
docker rm -f vt_restore_test >/dev/null 2>&1 || true
docker run -d --name vt_restore_test \
  -e POSTGRES_USER=volley -e POSTGRES_PASSWORD=test -e POSTGRES_DB=volleytime_restore \
  postgres:16-alpine >/dev/null

for i in $(seq 1 60); do
  docker exec vt_restore_test pg_isready -U volley -d volleytime_restore >/dev/null 2>&1 && break
  [ "$i" = "60" ] && fail "postgres не поднялся за 60 с"
  sleep 1
done

echo "[restore-test] restoring ${LATEST}..."
# ON_ERROR_STOP=1: частично сломанный дамп больше не считается успехом
gunzip -c "$DUMP" | docker exec -i vt_restore_test \
  psql -v ON_ERROR_STOP=1 -U volley -d volleytime_restore >/dev/null || fail "restore завершился с ошибкой"

echo "[restore-test] verifying..."
TABLES=$(docker exec vt_restore_test psql -tAX -U volley -d volleytime_restore -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
[ "${TABLES:-0}" -ge 10 ] || fail "в восстановленной БД только ${TABLES} таблиц"

for t in users organizations organization_members events bookings payments ledger_entries sessions verifications; do
  docker exec vt_restore_test psql -v ON_ERROR_STOP=1 -tAX -U volley -d volleytime_restore \
    -c "SELECT count(*) FROM ${t}" >/dev/null || fail "таблица ${t} недоступна после restore"
done

docker exec vt_restore_test psql -tAX -U volley -d volleytime_restore -c \
  "SELECT 'users=' || (SELECT count(*) FROM users) || ' events=' || (SELECT count(*) FROM events) || ' bookings=' || (SELECT count(*) FROM bookings)"

cleanup
ping_healthcheck
echo "[restore-test] OK — backup ${LATEST} restored and verified (${TABLES} таблиц)."
