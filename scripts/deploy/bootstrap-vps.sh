#!/usr/bin/env bash
set -Eeuo pipefail

readonly INSTALL_DIR="/opt/donhang-9chum"
readonly DEPLOY_USER="donhang-deploy"
readonly DEPLOY_HOME="/home/${DEPLOY_USER}"
readonly GATEWAY_PATH="/usr/local/sbin/donhang-deploy-gateway"
readonly RELEASE_PATH="/usr/local/sbin/donhang-release"
readonly BACKUP_PATH="/usr/local/sbin/donhang-backup"
readonly SEED_PATH="/usr/local/sbin/donhang-seed-admin"
readonly RESTORE_VERIFY_PATH="/usr/local/sbin/donhang-verify-restore"
readonly SSH_MATCH_FILE="/etc/ssh/sshd_config.d/90-donhang-deploy.conf"
readonly SUDOERS_FILE="/etc/sudoers.d/donhang-deploy"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  printf 'Usage: %s --audit-approved --deploy-public-key-file PATH --backup-dir PATH [--install-backup-timer]\n' "$0" >&2
  exit 64
}

[[ $(id -u) -eq 0 ]] || fail "Bootstrap must run as root."

audit_approved=false
install_backup_timer=false
deploy_public_key_file=""
backup_dir=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --audit-approved)
      audit_approved=true
      shift
      ;;
    --deploy-public-key-file)
      [[ $# -ge 2 ]] || usage
      deploy_public_key_file="$2"
      shift 2
      ;;
    --backup-dir)
      [[ $# -ge 2 ]] || usage
      backup_dir="$2"
      shift 2
      ;;
    --install-backup-timer)
      install_backup_timer=true
      shift
      ;;
    *) usage ;;
  esac
done

[[ ${audit_approved} == true ]] || fail "A successful read-only audit must be acknowledged."
[[ -f ${deploy_public_key_file} ]] || fail "Deploy public key file is missing."
[[ ${backup_dir} == /* && ${backup_dir} != "/" && ${backup_dir} != *".."* ]] \
  || fail "Backup directory must be a specific absolute path."
[[ ${backup_dir} =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "Backup directory contains unsupported characters."
[[ ! -e ${SSH_MATCH_FILE} && ! -e ${SUDOERS_FILE} ]] \
  || fail "Deploy-account security configuration already exists."

for command_name in \
  awk curl docker flock grep install mv openssl passwd realpath sha256sum ssh-keygen \
  sshd stat sudo systemctl uname useradd visudo; do
  command -v "${command_name}" >/dev/null 2>&1 || fail "Required command is missing: ${command_name}"
done
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."
mv --help 2>&1 | grep -q -- '--no-target-directory' \
  || fail "GNU mv with --no-target-directory support is required."
[[ $(uname -m) == "x86_64" ]] || fail "VPS must be x86_64 for the published images."
memory_kib="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
[[ ${memory_kib} =~ ^[0-9]+$ ]] && (( memory_kib >= 2097152 )) \
  || fail "VPS must have at least 2 GiB RAM."
[[ $(docker info --format '{{.Swarm.LocalNodeState}}') == "inactive" ]] \
  || fail "Docker must be in standalone mode."

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd -- "${script_dir}/../.." && pwd)"
[[ -f ${repository_root}/compose.production.yml ]] || fail "compose.production.yml is missing from the bundle."

read -r key_type key_data _ <"${deploy_public_key_file}" || fail "Cannot read deploy public key."
[[ ${key_type} == "ssh-ed25519" ]] || fail "Deploy key must be Ed25519."
[[ ${key_data} =~ ^[A-Za-z0-9+/]+={0,2}$ ]] || fail "Deploy public key is malformed."
ssh-keygen -l -f "${deploy_public_key_file}" >/dev/null 2>&1 || fail "Deploy public key is invalid."

if id "${DEPLOY_USER}" >/dev/null 2>&1; then
  fail "Deploy account already exists; bootstrap refuses to overwrite it."
fi
[[ ! -e ${INSTALL_DIR}/runtime.env ]] || fail "runtime.env already exists; bootstrap refuses to rotate production secrets."

app_port="$("${script_dir}/select-port.sh")"
database_password="$(openssl rand -hex 32)"
database_admin_password="$(openssl rand -hex 32)"
database_migrator_password="$(openssl rand -hex 32)"

install -d -m 0755 -o root -g root "${INSTALL_DIR}"
install -d -m 0700 -o root -g root \
  "${INSTALL_DIR}/state" "${INSTALL_DIR}/releases" "${backup_dir}"
install -d -m 0755 -o root -g root "${INSTALL_DIR}/postgres"
install -m 0755 -o root -g root \
  "${repository_root}/deploy/postgres/init-app.sh" \
  "${INSTALL_DIR}/postgres/init-app.sh"
install -m 0644 -o root -g root \
  "${repository_root}/deploy/postgres/backup-signature.sql" \
  "${INSTALL_DIR}/postgres/backup-signature.sql"
install -d -m 0755 -o root -g root /usr/local/libexec
install -m 0644 -o root -g root \
  "${script_dir}/backup-functions.sh" \
  /usr/local/libexec/donhang-backup-functions
install -m 0755 -o root -g root "${script_dir}/release-launcher.sh" "${RELEASE_PATH}"
install -m 0755 -o root -g root "${script_dir}/backup.sh" "${BACKUP_PATH}"
install -m 0755 -o root -g root "${script_dir}/seed-admin.sh" "${SEED_PATH}"
install -m 0755 -o root -g root "${script_dir}/verify-restore.sh" "${RESTORE_VERIFY_PATH}"
install -m 0755 -o root -g root "${script_dir}/forced-command.sh" "${GATEWAY_PATH}"

runtime_env="${INSTALL_DIR}/runtime.env"
install -m 0600 -o root -g root /dev/null "${runtime_env}"
{
  printf 'POSTGRES_DB=donhang\n'
  printf 'POSTGRES_USER=donhang_app\n'
  printf 'POSTGRES_PASSWORD=%s\n' "${database_password}"
  printf 'POSTGRES_ADMIN_USER=donhang_admin\n'
  printf 'POSTGRES_ADMIN_PASSWORD=%s\n' "${database_admin_password}"
  printf 'POSTGRES_MIGRATOR_USER=donhang_migrator\n'
  printf 'POSTGRES_MIGRATOR_PASSWORD=%s\n' "${database_migrator_password}"
  printf 'DATABASE_URL=postgresql://donhang_app:%s@db:5432/donhang?schema=public\n' "${database_password}"
  printf 'MIGRATION_DATABASE_URL=postgresql://donhang_migrator:%s@db:5432/donhang?schema=public\n' "${database_migrator_password}"
  printf 'POSTGRES_INIT_SCRIPT=%s/postgres/init-app.sh\n' "${INSTALL_DIR}"
  printf 'NODE_ENV=production\n'
  printf 'AUTH_SESSION_TTL_DAYS=7\n'
  printf 'AUTH_COOKIE_NAME=donhang_session\n'
  printf 'APP_ORIGIN=https://donhang.9chum.vn\n'
  printf 'APP_PORT=%s\n' "${app_port}"
  printf 'BACKUP_DIR=%s\n' "${backup_dir}"
  printf 'SMOKE_URL=https://donhang.9chum.vn/api/health\n'
} >"${runtime_env}"
unset database_password database_admin_password database_migrator_password

useradd --create-home --home-dir "${DEPLOY_HOME}" --shell /bin/bash "${DEPLOY_USER}"
passwd --lock "${DEPLOY_USER}" >/dev/null
install -d -m 0700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh"
authorized_keys="${DEPLOY_HOME}/.ssh/authorized_keys"
install -m 0600 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" /dev/null "${authorized_keys}"
printf 'restrict,command="%s" %s %s donhang-github-actions\n' \
  "${GATEWAY_PATH}" "${key_type}" "${key_data}" >"${authorized_keys}"

install -m 0440 -o root -g root /dev/null "${SUDOERS_FILE}"
printf '%s ALL=(root) NOPASSWD: %s *\n' "${DEPLOY_USER}" "${RELEASE_PATH}" >"${SUDOERS_FILE}"
visudo -cf "${SUDOERS_FILE}" >/dev/null || fail "Generated sudoers rule is invalid."

install -m 0644 -o root -g root /dev/null "${SSH_MATCH_FILE}"
{
  printf 'Match User %s\n' "${DEPLOY_USER}"
  printf '    AuthenticationMethods publickey\n'
  printf '    PasswordAuthentication no\n'
  printf '    KbdInteractiveAuthentication no\n'
  printf '    DisableForwarding yes\n'
  printf '    PermitTTY no\n'
  printf '    ForceCommand %s\n' "${GATEWAY_PATH}"
} >"${SSH_MATCH_FILE}"
if ! sshd -t; then
  rm -f -- "${SSH_MATCH_FILE}"
  fail "Generated sshd configuration is invalid and was removed."
fi
systemctl reload ssh || systemctl reload sshd || fail "Could not reload sshd."

if [[ ${install_backup_timer} == true ]]; then
  install -m 0644 -o root -g root \
    "${repository_root}/deploy/systemd/donhang-backup.service" \
    /etc/systemd/system/donhang-backup.service
  install -m 0644 -o root -g root \
    "${repository_root}/deploy/systemd/donhang-backup.timer" \
    /etc/systemd/system/donhang-backup.timer
  systemctl daemon-reload
  systemctl enable --now donhang-backup.timer
fi

printf 'Bootstrap complete. APP_PORT=%s\n' "${app_port}"
printf 'LiteSpeed, TLS, firewall, and backup collection still require audited host-specific configuration.\n'
