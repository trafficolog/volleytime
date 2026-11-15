#!/usr/bin/env bash
# Task 27.2.1 (audit CI-01): SSH client for the VPS steps of the workflows.
# The host key is pinned from the VPS_KNOWN_HOSTS secret (known_hosts lines):
# no trust on first use, so a missing or wrong host key fails the connection
# ("Host key verification failed.") before any remote command runs.
# Writes ~/.ssh/config with Host alias `vps`; steps call `ssh -n vps ...` and
# `scp -O -r ... vps:...`. Never prints the key or the known_hosts content.
set -euo pipefail

: "${VPS_HOST:?VPS_HOST secret is required}"
: "${VPS_SSH_KEY:?VPS_SSH_KEY secret is required}"
: "${VPS_KNOWN_HOSTS:?VPS_KNOWN_HOSTS secret is required (pinned VPS host key, see deploy runbook)}"
# A bare host name or address only: the value goes into the client config.
if ! [[ "$VPS_HOST" =~ ^[A-Za-z0-9._:-]+$ ]]; then
  echo 'VPS_HOST must be a bare host name or IP address' >&2
  exit 1
fi

ssh_dir="$HOME/.ssh"
umask 077
mkdir -p "$ssh_dir"
chmod 700 "$ssh_dir"
printf '%s\n' "$VPS_SSH_KEY" > "$ssh_dir/vps_deploy_key"
printf '%s\n' "$VPS_KNOWN_HOSTS" > "$ssh_dir/vps_known_hosts"
chmod 600 "$ssh_dir/vps_deploy_key" "$ssh_dir/vps_known_hosts"

if ! ssh-keygen -F "$VPS_HOST" -f "$ssh_dir/vps_known_hosts" > /dev/null; then
  echo 'VPS_KNOWN_HOSTS has no entry for VPS_HOST' >&2
  exit 1
fi

cat > "$ssh_dir/config" << EOF
Host vps
  HostName $VPS_HOST
  User deploy
  IdentityFile "$ssh_dir/vps_deploy_key"
  IdentitiesOnly yes
  UserKnownHostsFile "$ssh_dir/vps_known_hosts"
  GlobalKnownHostsFile /dev/null
  StrictHostKeyChecking yes
  UpdateHostKeys no
  BatchMode yes
  ConnectTimeout 120
  ServerAliveInterval 30
  ServerAliveCountMax 4
EOF
chmod 600 "$ssh_dir/config"
echo 'VPS SSH configured with a pinned host key'
