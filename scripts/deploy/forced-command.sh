#!/usr/bin/env bash
set -Eeuo pipefail

readonly EX_USAGE=64
readonly RELEASE_COMMAND="/usr/local/sbin/donhang-release"
export PATH="/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

reject_command() {
  printf 'Command rejected.\n' >&2
  exit "${EX_USAGE}"
}

parse_command() {
  local original_command="${1:-}"

  if [[ ${original_command} =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return
  fi

  reject_command
}

if [[ ${1:-} == "--validate-only" ]]; then
  [[ $# -eq 2 ]] || reject_command
  parse_command "$2"
  exit 0
fi

[[ $# -eq 0 ]] || reject_command
release_sha="$(parse_command "${SSH_ORIGINAL_COMMAND:-}")"
exec /usr/bin/sudo -n "${RELEASE_COMMAND}" "${release_sha}"
