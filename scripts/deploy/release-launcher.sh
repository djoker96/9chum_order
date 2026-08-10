#!/usr/bin/env bash
set -Eeuo pipefail

readonly EX_USAGE=64
readonly INSTALL_DIR="/opt/donhang-9chum"
readonly RELEASES_DIR="${INSTALL_DIR}/releases"
readonly RUNTIME_ENV="${INSTALL_DIR}/runtime.env"
readonly BUNDLE_LOCK_FILE="/run/lock/donhang-9chum-bundle.lock"
readonly IMAGE_REPOSITORY="ghcr.io/djoker96/9chum_order"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

validate_sha_or_exit() {
  [[ ${1:-} =~ ^[0-9a-f]{40}$ ]] || {
    printf 'Invalid release SHA.\n' >&2
    exit "${EX_USAGE}"
  }
}

if [[ ${1:-} == "--validate-only" ]]; then
  [[ $# -eq 2 ]] || validate_sha_or_exit ""
  validate_sha_or_exit "$2"
  printf '%s\n' "$2"
  exit 0
fi

[[ $# -eq 1 ]] || validate_sha_or_exit ""
readonly RELEASE_SHA="$1"
validate_sha_or_exit "${RELEASE_SHA}"

[[ $(id -u) -eq 0 ]] || fail "Release launcher must run as root."
[[ -f ${RUNTIME_ENV} ]] || fail "Runtime environment is missing."
[[ $(stat -c '%a' "${RUNTIME_ENV}") == "600" ]] || fail "runtime.env must have mode 0600."
[[ $(stat -c '%U' "${RUNTIME_ENV}") == "root" ]] || fail "runtime.env must be owned by root."

install -d -m 0700 -o root -g root "${RELEASES_DIR}"
install -d -m 0755 -o root -g root "$(dirname "${BUNDLE_LOCK_FILE}")"

exec 8>"${BUNDLE_LOCK_FILE}"
flock -n 8 || fail "Another deployment bundle is being prepared."

readonly OPS_IMAGE="${IMAGE_REPOSITORY}:ops-${RELEASE_SHA}"
docker pull "${OPS_IMAGE}" >/dev/null

revision="$(docker image inspect \
  --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
  "${OPS_IMAGE}")"
[[ ${revision} == "${RELEASE_SHA}" ]] \
  || fail "Ops image revision label does not match the requested release."

readonly RELEASE_DIR="${RELEASES_DIR}/${RELEASE_SHA}"
if [[ ! -d ${RELEASE_DIR} ]]; then
  partial_dir="$(mktemp -d "${RELEASES_DIR}/.${RELEASE_SHA}.XXXXXX")"
  bundle_container=""
  cleanup() {
    if [[ -n ${bundle_container} ]]; then
      docker rm --force "${bundle_container}" >/dev/null 2>&1 || true
    fi
    if [[ -n ${partial_dir:-} && -d ${partial_dir} ]]; then
      rm -rf -- "${partial_dir}"
    fi
  }
  trap cleanup EXIT

  bundle_container="$(docker create "${OPS_IMAGE}")"
  docker cp "${bundle_container}:/deploy-bundle/." "${partial_dir}/"
  docker rm "${bundle_container}" >/dev/null
  bundle_container=""

  [[ -f ${partial_dir}/SHA256SUMS ]] || fail "Deployment bundle checksum manifest is missing."
  (
    cd "${partial_dir}"
    sha256sum --check --strict SHA256SUMS >/dev/null
    bash -n scripts/deploy/*.sh
  )
  [[ -x ${partial_dir}/scripts/deploy/release.sh ]] \
    || fail "Bundled release runner is not executable."

  chown -R root:root "${partial_dir}"
  chmod -R go-w "${partial_dir}"
  mv "${partial_dir}" "${RELEASE_DIR}"
  partial_dir=""
  trap - EXIT
fi

(
  cd "${RELEASE_DIR}"
  sha256sum --check --strict SHA256SUMS >/dev/null
)

exec "${RELEASE_DIR}/scripts/deploy/release.sh" "${RELEASE_SHA}"
