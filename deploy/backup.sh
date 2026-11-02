#!/bin/sh
set -eu
umask 077
export PGPASSWORD="$(cat /run/secrets/db_password)"
mkdir -p /backups
while :; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  if pg_dump -Fc -f "/backups/$stamp.dump.tmp"; then
    mv "/backups/$stamp.dump.tmp" "/backups/$stamp.dump"
    find /backups -name '*.dump' -mtime +14 -delete
    echo "BACKUP_OK $stamp"
  else
    rm -f "/backups/$stamp.dump.tmp"
    echo 'BACKUP_FAILED' >&2
  fi
  sleep 86400 & wait $!
done
