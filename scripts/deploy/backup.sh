#!/usr/bin/env bash
set -Eeuo pipefail

readonly INSTALL_DIR="/opt/donhang-9chum"
readonly COMPOSE_FILE="${INSTALL_DIR}/current/compose.production.yml"
readonly RUNTIME_ENV="${INSTALL_DIR}/runtime.env"
readonly CURRENT_SHA_FILE="${INSTALL_DIR}/state/current-sha"
readonly SIGNATURE_SQL="${INSTALL_DIR}/postgres/backup-signature.sql"
readonly BACKUP_FUNCTIONS="/usr/local/libexec/donhang-backup-functions"
readonly IMAGE_REPOSITORY="ghcr.io/djoker96/9chum_order"
readonly LOCK_FILE="/run/lock/donhang-9chum-maintenance.lock"

log() {
  printf '%s %s\n' "$(date --iso-8601=seconds)" "$*"
}

fail() {
  log "ERROR: $*" >&2
  exit 1
}

is_valid_label() {
  [[ ${1:-} =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]]
}

if [[ ${1:-} == "--validate-label" ]]; then
  [[ $# -eq 2 ]] || exit 64
  is_valid_label "$2" || exit 64
  printf '%s\n' "$2"
  exit 0
fi

[[ $# -le 1 ]] || exit 64
readonly BACKUP_LABEL="${1:-daily}"
is_valid_label "${BACKUP_LABEL}" || {
  printf 'Invalid backup label.\n' >&2
  exit 64
}

[[ $(id -u) -eq 0 ]] || fail "Backup script must run as root."
[[ -f ${RUNTIME_ENV} ]] || fail "runtime.env is missing."
[[ $(stat -c '%a' "${RUNTIME_ENV}") == "600" ]] || fail "runtime.env must have mode 0600."
[[ $(stat -c '%U' "${RUNTIME_ENV}") == "root" ]] || fail "runtime.env must be owned by root."
[[ -f ${CURRENT_SHA_FILE} && -f ${COMPOSE_FILE} ]] || fail "No successful release is recorded."
[[ -f ${SIGNATURE_SQL} && -f ${BACKUP_FUNCTIONS} ]] || fail "Backup verification assets are missing."

release_sha="$(<"${CURRENT_SHA_FILE}")"
[[ ${release_sha} =~ ^[0-9a-f]{40}$ ]] || fail "Stored release SHA is invalid."
[[ $(realpath -e -- "${COMPOSE_FILE}") == "${INSTALL_DIR}/releases/${release_sha}/compose.production.yml" ]] \
  || fail "Current deployment bundle does not match the recorded release."

set -a
# shellcheck disable=SC1090
source "${RUNTIME_ENV}"
set +a

readonly POSTGRES_DB
readonly POSTGRES_MIGRATOR_USER
readonly BACKUP_DIR="${BACKUP_DIR:-/var/backups/donhang-9chum}"

[[ ${POSTGRES_DB:-} =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || fail "POSTGRES_DB is invalid."
[[ ${POSTGRES_MIGRATOR_USER:-} =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] \
  || fail "POSTGRES_MIGRATOR_USER is invalid."
[[ ${BACKUP_DIR} == /* && ${BACKUP_DIR} != "/" && ${BACKUP_DIR} != *".."* ]] \
  || fail "BACKUP_DIR must be a specific absolute path."

install -d -m 0700 -o root -g root "${BACKUP_DIR}"
exec 9>"${LOCK_FILE}"
flock -n 9 || fail "Another release, backup, or restore verification is running."

compose() {
  APP_IMAGE="${IMAGE_REPOSITORY}:app-${release_sha}" \
  OPS_IMAGE="${IMAGE_REPOSITORY}:ops-${release_sha}" \
    docker compose \
      --project-name donhang-9chum \
      --env-file "${RUNTIME_ENV}" \
      --file "${COMPOSE_FILE}" \
      "$@"
}

# shellcheck disable=SC1090
source "${BACKUP_FUNCTIONS}"
create_verified_backup "${BACKUP_LABEL}"
