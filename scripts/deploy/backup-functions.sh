#!/usr/bin/env bash

# This file is sourced by release.sh and backup.sh. Callers provide compose(),
# POSTGRES_DB, POSTGRES_MIGRATOR_USER, BACKUP_DIR, SIGNATURE_SQL, fail(), and log().

database_signature() {
  compose exec -T db \
    psql \
      --username "${POSTGRES_MIGRATOR_USER}" \
      --dbname "${POSTGRES_DB}" \
      --quiet \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 <"${SIGNATURE_SQL}" \
    | tr -d '\r\n'
}

create_verified_backup() {
  local label="$1"
  local timestamp
  local target
  local temporary
  local temporary_meta
  local before_signature
  local after_signature
  local attempt
  local completed=false

  timestamp="$(date +'%Y%m%dT%H%M%S%z')"
  target="${BACKUP_DIR}/${timestamp}-${label}.dump"
  temporary="${target}.partial"
  temporary_meta="${target}.meta.partial"

  umask 077
  for attempt in 1 2 3; do
    before_signature="$(database_signature)"
    if ! compose exec -T db \
      pg_dump \
        --format=custom \
        --no-owner \
        --no-privileges \
        --username "${POSTGRES_MIGRATOR_USER}" \
        --dbname "${POSTGRES_DB}" >"${temporary}"; then
      rm -f -- "${temporary}" "${temporary_meta}"
      fail "Database backup command failed."
    fi
    after_signature="$(database_signature)"

    if [[ ${before_signature} == "${after_signature}" ]]; then
      completed=true
      break
    fi

    log "Application data changed during backup attempt ${attempt}; retrying."
    rm -f -- "${temporary}"
  done

  [[ ${completed} == true ]] || {
    rm -f -- "${temporary}" "${temporary_meta}"
    fail "Could not capture a stable application-data backup after three attempts."
  }
  [[ -s ${temporary} ]] || {
    rm -f -- "${temporary}" "${temporary_meta}"
    fail "Database backup is empty."
  }
  compose exec -T db pg_restore --list <"${temporary}" >/dev/null || {
    rm -f -- "${temporary}" "${temporary_meta}"
    fail "Database backup archive validation failed."
  }

  printf '%s\n' "${before_signature}" >"${temporary_meta}"
  mv "${temporary}" "${target}"
  mv "${temporary_meta}" "${target}.meta"
  (
    cd "$(dirname "${target}")"
    sha256sum "$(basename "${target}")" "$(basename "${target}").meta" \
      >"$(basename "${target}").sha256"
  )

  log "Database backup created: ${target}"
}
