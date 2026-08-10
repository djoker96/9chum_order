#!/usr/bin/env bash
set -uo pipefail

readonly MINIMUM_MEMORY_KIB=2097152
blockers=0

section() {
  printf '\n== %s ==\n' "$1"
}

run_read_only() {
  printf '$ %s\n' "$*"
  "$@" 2>&1 || true
}

section "Host"
run_read_only uname -a
run_read_only uptime
run_read_only df -hT
run_read_only free -h

architecture="$(uname -m 2>/dev/null || printf 'unknown')"
if [[ ${architecture} != "x86_64" ]]; then
  printf 'BLOCKER: VPS architecture must be x86_64 for the published production images (found %s).\n' \
    "${architecture}" >&2
  blockers=$((blockers + 1))
fi

memory_kib="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo 2>/dev/null || printf '0')"
if (( memory_kib < MINIMUM_MEMORY_KIB )); then
  printf 'BLOCKER: RAM is below 2 GiB.\n' >&2
  blockers=$((blockers + 1))
fi

section "Docker and Portainer"
if ! command -v docker >/dev/null 2>&1; then
  printf 'BLOCKER: Docker is not installed.\n' >&2
  blockers=$((blockers + 1))
else
  run_read_only docker version
  run_read_only docker compose version
  run_read_only docker info --format 'Server={{.ServerVersion}} Driver={{.Driver}} Swarm={{.Swarm.LocalNodeState}} Rootless={{json .SecurityOptions}}'
  swarm_state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || printf 'unknown')"
  if [[ ${swarm_state} != "inactive" ]]; then
    printf 'BLOCKER: Docker is not in standalone mode (Swarm=%s).\n' "${swarm_state}" >&2
    blockers=$((blockers + 1))
  fi
  run_read_only docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  run_read_only docker network ls
  run_read_only docker volume ls
  run_read_only docker ps --filter name=portainer --format 'Portainer={{.Names}} Image={{.Image}} Status={{.Status}} Ports={{.Ports}}'
fi

section "Listeners and firewall"
run_read_only ss -lntup
command -v ufw >/dev/null 2>&1 && run_read_only ufw status verbose
command -v firewall-cmd >/dev/null 2>&1 && run_read_only firewall-cmd --list-all
command -v nft >/dev/null 2>&1 && run_read_only nft list ruleset

section "LiteSpeed and VPanel"
run_read_only systemctl status lsws --no-pager
run_read_only systemctl status openlitespeed --no-pager
run_read_only pgrep -a -f 'lshttpd|litespeed|vpanel'
[[ -x /usr/local/lsws/bin/lswsctrl ]] && run_read_only /usr/local/lsws/bin/lswsctrl status
[[ -x /usr/local/lsws/bin/openlitespeed ]] \
  && run_read_only /usr/local/lsws/bin/openlitespeed -t
for candidate in /usr/local/lsws/conf /usr/local/lsws/conf/vhosts /etc/openlitespeed /etc/vpanel /opt/vpanel; do
  if [[ -e ${candidate} ]]; then
    run_read_only ls -la "${candidate}"
  fi
done
run_read_only grep -RIl --include='*.conf' --include='vhconf.conf' \
  'donhang\.9chum\.vn' /usr/local/lsws/conf /etc/openlitespeed /etc/vpanel /opt/vpanel

section "Current domain and certificate"
run_read_only getent ahostsv4 donhang.9chum.vn
run_read_only curl --head --max-time 10 http://donhang.9chum.vn
run_read_only curl --head --max-time 10 https://donhang.9chum.vn
if command -v openssl >/dev/null 2>&1; then
  certificate_summary="$(timeout 15 openssl s_client \
    -connect donhang.9chum.vn:443 \
    -servername donhang.9chum.vn \
    </dev/null 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates -ext subjectAltName 2>/dev/null || true)"
  printf '%s\n' "${certificate_summary}"
fi

section "Existing backup and ACME automation"
run_read_only systemctl list-timers --all --no-pager
run_read_only ls -la /var/backups
run_read_only crontab -l
run_read_only find /etc/cron.d /etc/cron.daily -maxdepth 1 -type f -print
run_read_only systemctl status certbot.timer --no-pager
run_read_only certbot certificates

section "Candidate application port"
script_source="${BASH_SOURCE[0]-}"
if [[ -n ${script_source} ]]; then
  script_dir="$(cd -- "$(dirname -- "${script_source}")" && pwd)"
else
  script_dir=""
fi
select_candidate_port() {
  local port

  if [[ -x ${script_dir}/select-port.sh ]]; then
    "${script_dir}/select-port.sh"
    return
  fi

  for ((port = 3101; port <= 3199; port += 1)); do
    if ! ss -H -ltn "sport = :${port}" | grep -q .; then
      printf '%s\n' "${port}"
      return
    fi
  done

  return 1
}

if ! select_candidate_port; then
  printf 'BLOCKER: No free loopback port exists in 3101-3199.\n' >&2
  blockers=$((blockers + 1))
fi

printf '\nAUDIT_BLOCKERS=%s\n' "${blockers}"
(( blockers == 0 ))
