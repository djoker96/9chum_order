#!/usr/bin/env bash
set -Eeuo pipefail

readonly INSTALL_DIR="/opt/donhang-9chum"
readonly RUNTIME_ENV="${INSTALL_DIR}/runtime.env"
readonly CURRENT_SHA_FILE="${INSTALL_DIR}/state/current-sha"
readonly INIT_SCRIPT="${INSTALL_DIR}/postgres/init-app.sh"
readonly SIGNATURE_SQL="${INSTALL_DIR}/postgres/backup-signature.sql"
readonly LOCK_FILE="/run/lock/donhang-9chum-maintenance.lock"
readonly POSTGRES_IMAGE="postgres:16.14-bookworm@sha256:64154d0babcb1741988719e703419af0382b19953706149f9872fbd0f438efa8"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ $# -eq 1 ]] || {
  printf 'Usage: %s /absolute/path/to/backup.dump\n' "$0" >&2
  exit 64
}
[[ $(id -u) -eq 0 ]] || fail "Restore verification must run as root."
[[ -f ${RUNTIME_ENV} && -f ${CURRENT_SHA_FILE} ]] || fail "Production runtime state is incomplete."
[[ -x ${INIT_SCRIPT} && -f ${SIGNATURE_SQL} ]] || fail "Restore verification assets are missing."

set -a
# shellcheck disable=SC1090
source "${RUNTIME_ENV}"
set +a

readonly BACKUP_DIR="${BACKUP_DIR:-/var/backups/donhang-9chum}"
backup_file="$(realpath -e -- "$1")"
backup_root="$(realpath -e -- "${BACKUP_DIR}")"
[[ ${backup_file} == "${backup_root}/"* ]] || fail "Backup must be inside the configured backup directory."
[[ ${backup_file} == *.dump ]] || fail "Backup file must use the .dump suffix."

metadata_file="${backup_file}.meta"
checksum_file="${backup_file}.sha256"
[[ -f ${metadata_file} && -f ${checksum_file} ]] \
  || fail "Backup metadata or checksum is missing."

(
  cd "$(dirname "${backup_file}")"
  sha256sum --check --strict "$(basename "${checksum_file}")" >/dev/null
) || fail "Backup checksum verification failed."

expected_signature="$(tr -d '\r\n' <"${metadata_file}")"
[[ -n ${expected_signature} ]] || fail "Backup metadata is empty."

install -d -m 0755 -o root -g root "$(dirname "${LOCK_FILE}")"
exec 9>"${LOCK_FILE}"
flock -n 9 || fail "Another release, backup, or restore verification is running."

container_name="donhang-restore-verify-$$-${RANDOM}"
restore_admin_password="$(openssl rand -hex 24)"
restore_migrator_password="$(openssl rand -hex 24)"
restore_app_password="$(openssl rand -hex 24)"
cleanup() {
  docker rm --force --volumes "${container_name}" >/dev/null 2>&1 || true
  unset restore_admin_password restore_migrator_password restore_app_password
}
trap cleanup EXIT

docker run \
  --detach \
  --name "${container_name}" \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=1g \
  --env POSTGRES_PASSWORD="${restore_admin_password}" \
  "${POSTGRES_IMAGE}" >/dev/null

for _ in {1..60}; do
  if docker exec "${container_name}" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "${container_name}" pg_isready --username postgres --dbname postgres >/dev/null \
  || fail "Temporary restore database did not become ready."

docker cp "${INIT_SCRIPT}" "${container_name}:/tmp/init-app.sh"
docker exec \
  --env POSTGRES_USER=postgres \
  --env APP_DB_NAME=restore_verify \
  --env APP_DB_USER=restore_app \
  --env APP_DB_PASSWORD="${restore_app_password}" \
  --env MIGRATOR_DB_USER=restore_migrator \
  --env MIGRATOR_DB_PASSWORD="${restore_migrator_password}" \
  "${container_name}" /tmp/init-app.sh

docker cp "${backup_file}" "${container_name}:/tmp/backup.dump"
docker exec "${container_name}" pg_restore \
  --username restore_migrator \
  --dbname restore_verify \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  /tmp/backup.dump

restored_signature="$(docker exec --interactive "${container_name}" psql \
  --username restore_migrator \
  --dbname restore_verify \
  --quiet \
  --tuples-only \
  --no-align \
  --set ON_ERROR_STOP=1 <"${SIGNATURE_SQL}" | tr -d '\r\n')"

[[ ${restored_signature} == "${expected_signature}" ]] \
  || fail "Restored application data or invoice-number sequences do not match backup metadata."

docker exec \
  --env PGPASSWORD="${restore_app_password}" \
  "${container_name}" psql \
    --host 127.0.0.1 \
    --username restore_app \
    --dbname restore_verify \
    --set ON_ERROR_STOP=1 \
    --command "BEGIN; SELECT COUNT(*) FROM invoices; INSERT INTO products (id, external_id, name, concentration, volume, price, updated_at) VALUES ('restore-runtime-check', 'restore-runtime-check', 'Restore check', '0%', '1ml', 1, CURRENT_TIMESTAMP); ROLLBACK;" \
    >/dev/null

if docker exec \
  --env PGPASSWORD="${restore_app_password}" \
  "${container_name}" psql \
    --host 127.0.0.1 \
    --username restore_app \
    --dbname restore_verify \
    --set ON_ERROR_STOP=1 \
    --command "CREATE TABLE restore_role_must_not_create(id integer);" \
    >/dev/null 2>&1; then
  fail "Restored runtime role unexpectedly has DDL privileges."
fi

printf 'Restore verification passed for %s with production-equivalent roles.\n' "${backup_file}"
