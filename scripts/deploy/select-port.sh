#!/usr/bin/env bash
set -Eeuo pipefail

readonly FIRST_PORT=3101
readonly LAST_PORT=3199

select_first_free_port() {
  local occupied_ports="$1"
  local port

  for ((port = FIRST_PORT; port <= LAST_PORT; port += 1)); do
    if ! grep --fixed-strings --line-regexp --quiet "${port}" <<<"${occupied_ports}"; then
      printf '%s\n' "${port}"
      return 0
    fi
  done

  printf 'No free app port in 3101-3199.\n' >&2
  return 1
}

if [[ ${1:-} == "--occupied" ]]; then
  shift
  occupied_from_arguments=""
  for port_argument in "$@"; do
    [[ ${port_argument} =~ ^[0-9]{1,5}$ ]] || {
      printf 'Invalid occupied port.\n' >&2
      exit 64
    }
    occupied_from_arguments+="${port_argument}"$'\n'
  done
  select_first_free_port "${occupied_from_arguments}"
  exit
fi

[[ $# -eq 0 ]] || {
  printf 'Usage: select-port.sh\n' >&2
  exit 64
}

command -v ss >/dev/null 2>&1 || {
  printf 'The ss command is required.\n' >&2
  exit 1
}

occupied_from_system="$(
  ss --tcp --listening --numeric --no-header \
    | awk '{ address = $4; sub(/^.*:/, "", address); print address }'
)"
select_first_free_port "${occupied_from_system}"
