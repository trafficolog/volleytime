// Docker identity/quiescence boundary for the existing executable deploy harnesses.
// No command falls through to the host's Docker daemon.
export const splitRollbackDockerFixture = `
rollback_ref() {
  if [ -n "\${WEB_STATE:-}" ]; then
    if [ "$1" = web ]; then cat "$WEB_STATE"; else cat "$BOT_STATE"; fi
  else
    sha="$(cat "$LIVE_SHA")"
    if [ "$1" = web ] && [ -f "$PARTIAL_WEB_SHA" ]; then sha="$(cat "$PARTIAL_WEB_SHA")"; fi
    prefix=volleytime-
    if [ "$sha" = "$OLD_SHA" ]; then prefix="\${FAKE_OLD_PREFIX:-volleytime-}"; fi
    printf '%s%s:%s' "$prefix" "$1" "$sha"
  fi
}
rollback_id() { if [ "$1" = web ]; then printf '%064d' 1; else printf '%064d' 2; fi; }
rollback_image() { printf 'sha256:%s%024d' "$1" 0; }
if [ "$1" = inspect ] && [ "$2" != --format ]; then
  shift; printf '['; separator=''
  for id in "$@"; do
    service=web; octet=3; running=true
    if [ "$id" = vt_postgres ]; then id="$(printf '%064d' 4)"; service=postgres; octet=2
    elif [ "$id" = "$(rollback_id bot)" ]; then service=bot; octet=4
    elif [ "$id" = "$(printf '%064d' 3)" ]; then octet=5; fi
    if [ "$service" != postgres ] && [ -f "$ROOT_PATH/.deploy/writers-stopped" ]; then running=false; fi
    printf '%s{"Id":"%s","State":{"Running":%s},"HostConfig":{"NetworkMode":"volleytime_backend"},"Config":{"Labels":{"com.docker.compose.project":"volleytime","com.docker.compose.service":"%s"},"Env":["DATABASE_URL=postgres://volley:fixture@postgres:5432/volleytime"]},"NetworkSettings":{"Ports":{},"Networks":{"volleytime_backend":{"NetworkID":"%s","Aliases":["%s"],"IPAddress":"172.20.0.%s","GlobalIPv6Address":"fd00::%s"}}}}' "$separator" "$id" "$running" "$service" "$(printf '%064d' 6)" "$service" "$octet" "$octet"
    separator=,
  done
  printf ']'; exit 0
fi
if [ "$1 $2" = 'network inspect' ]; then
  printf '[{"Id":"%s","Driver":"bridge","Scope":"local","Containers":{' "$(printf '%064d' 6)"
  separator=''
  for value in '4:2' '1:3' '2:4' '3:5'; do
    printf '%s"%s":{"IPv4Address":"172.20.0.%s/16","IPv6Address":"fd00::%s/64"}' "$separator" "$(printf '%064d' "\${value%%:*}")" "\${value##*:}" "\${value##*:}"
    separator=,
  done
  printf '}}]'; exit 0
fi
if [ "$1" = ps ]; then
  service=bot; [[ "$*" != *'service=web'* ]] || service=web
  if [[ "$*" == *' -a '* ]] || [ ! -f "$ROOT_PATH/.deploy/writers-stopped" ]; then
    rollback_id "$service"; printf '\\n'
    if [ "$service" = web ] && [ "\${FAKE_DUPLICATE_WRITERS:-0}" = 1 ]; then printf '%064d\\n' 3; fi
  fi
  exit 0
fi
if [ "$1" = stop ]; then
  touch "$ROOT_PATH/.deploy/writers-stopped"
  exit 0
fi
if [ "$1" = start ]; then
  rm -f "$ROOT_PATH/.deploy/writers-stopped"
  exit 0
fi
if [ "$1" = inspect ] && [[ "$3" == *'com.docker.compose.project'* ]]; then
  if [[ "$3" != *'.State.Running'* ]]; then printf 'volleytime'; exit 0; fi
  service=web; [ "\${@: -1}" != "$(rollback_id bot)" ] || service=bot
  ref="$(rollback_ref "$service")"; sha="\${ref##*:}"
  running=true; [ ! -f "$ROOT_PATH/.deploy/writers-stopped" ] || running=false
  printf '%s|%s|%s|volleytime|%s' "$running" "$(rollback_image "$sha")" "$ref" "$service"
  exit 0
fi
if [ "$1 $2" = 'image inspect' ] && [[ "\${3:-}" = --format && "$4" == *'org.volleytime.event-split-pricing'* ]]; then
  ref="\${@: -1}"
  sha="\${ref##*:}"
  if [[ "$ref" == sha256:* ]]; then sha="\${sha:0:40}"; fi
  split=1
  if [ "\${FAKE_FIXED_TARGET:-0}" = 1 ] && [ "$sha" = "$OLD_SHA" ]; then split=0; fi
  printf '%s|%s|%s' "$(rollback_image "$sha")" "$sha" "$split"
  exit 0
fi
if [ "$1" = compose ] && [[ "$*" == *' exec -T postgres psql '* ]]; then
  if [[ "$*" == *pg_stat_activity* ]]; then printf t; exit 0; fi
  if [ -f "$ROOT_PATH/.deploy/writers-stopped" ] && [ "\${FAKE_ROLLBACK_DB_ERROR:-0}" = 1 ]; then exit 17; fi
  if [[ "$*" == *information_schema* ]]; then printf t; else
    if [ "\${FAKE_SPLIT_ROWS:-0}" = 1 ]; then printf t; else printf f; fi
  fi
  exit 0
fi
`
