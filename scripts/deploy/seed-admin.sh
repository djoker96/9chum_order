#!/usr/bin/env bash
set -Eeuo pipefail

readonly INSTALL_DIR="/opt/donhang-9chum"
readonly COMPOSE_FILE="${INSTALL_DIR}/current/compose.production.yml"
readonly RUNTIME_ENV="${INSTALL_DIR}/runtime.env"
readonly CURRENT_SHA_FILE="${INSTALL_DIR}/state/current-sha"
readonly MARKER_FILE="${INSTALL_DIR}/state/admin-seeded"
readonly IMAGE_REPOSITORY="ghcr.io/djoker96/9chum_order"
readonly ADMIN_EMAIL="datjoker96@gmail.com"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ $(id -u) -eq 0 ]] || fail "Admin seed must run as root."
[[ -t 0 ]] || fail "Admin seed requires an interactive terminal."
[[ ! -e ${MARKER_FILE} ]] || fail "The production admin has already been seeded."
[[ -f ${CURRENT_SHA_FILE} && -f ${COMPOSE_FILE} ]] \
  || fail "Deploy a healthy release before seeding the admin."
[[ -f ${RUNTIME_ENV} && $(stat -c '%a' "${RUNTIME_ENV}") == "600" ]] \
  || fail "runtime.env is missing or has unsafe permissions."

release_sha="$(<"${CURRENT_SHA_FILE}")"
[[ ${release_sha} =~ ^[0-9a-f]{40}$ ]] || fail "Stored release SHA is invalid."
[[ $(realpath -e -- "${COMPOSE_FILE}") == "${INSTALL_DIR}/releases/${release_sha}/compose.production.yml" ]] \
  || fail "Current deployment bundle does not match the recorded release."

set -a
# shellcheck disable=SC1090
source "${RUNTIME_ENV}"
set +a

compose() {
  APP_IMAGE="${IMAGE_REPOSITORY}:app-${release_sha}" \
  OPS_IMAGE="${IMAGE_REPOSITORY}:ops-${release_sha}" \
    docker compose \
      --project-name donhang-9chum \
      --env-file "${RUNTIME_ENV}" \
      --file "${COMPOSE_FILE}" \
      "$@"
}

if [[ $(compose exec -T db psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --tuples-only \
  --no-align \
  --command "SELECT 1 FROM users WHERE email = '${ADMIN_EMAIL}' LIMIT 1") == "1" ]]; then
  fail "The production admin already exists; refusing to reset its password."
fi

read -r -s -p "Mật khẩu admin (tối thiểu 12 ký tự): " admin_password
printf '\n'
read -r -s -p "Nhập lại mật khẩu: " admin_password_confirmation
printf '\n'
trap 'unset admin_password admin_password_confirmation ADMIN_PASSWORD' EXIT

[[ ${#admin_password} -ge 12 ]] || fail "Mật khẩu phải có ít nhất 12 ký tự."
[[ ${admin_password} == "${admin_password_confirmation}" ]] || fail "Mật khẩu nhập lại không khớp."

export ADMIN_PASSWORD="${admin_password}"
export ADMIN_EMAIL
compose --profile ops run --rm --no-deps \
  --env ADMIN_EMAIL \
  --env ADMIN_PASSWORD \
  ops ./node_modules/.bin/tsx prisma/seed.ts

unset admin_password admin_password_confirmation ADMIN_PASSWORD
install -m 0600 -o root -g root /dev/null "${MARKER_FILE}"
printf 'Admin %s đã được tạo một lần.\n' "${ADMIN_EMAIL}"
