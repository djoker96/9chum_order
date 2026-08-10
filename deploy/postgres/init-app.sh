#!/usr/bin/env bash
set -Eeuo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${APP_DB_NAME:?APP_DB_NAME is required}"
: "${APP_DB_USER:?APP_DB_USER is required}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
: "${MIGRATOR_DB_USER:?MIGRATOR_DB_USER is required}"
: "${MIGRATOR_DB_PASSWORD:?MIGRATOR_DB_PASSWORD is required}"

[[ ${APP_DB_NAME} =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || {
  printf 'APP_DB_NAME is invalid.\n' >&2
  exit 1
}
[[ ${APP_DB_USER} =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || {
  printf 'APP_DB_USER is invalid.\n' >&2
  exit 1
}
[[ ${MIGRATOR_DB_USER} =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || {
  printf 'MIGRATOR_DB_USER is invalid.\n' >&2
  exit 1
}
[[ ${APP_DB_USER} != "${POSTGRES_USER}" \
  && ${MIGRATOR_DB_USER} != "${POSTGRES_USER}" \
  && ${APP_DB_USER} != "${MIGRATOR_DB_USER}" ]] || {
  printf 'PostgreSQL admin, migrator, and application roles must be different.\n' >&2
  exit 1
}

# Values are imported from the process environment inside psql so passwords
# never appear in the command line or process list.
psql \
  --set ON_ERROR_STOP=1 \
  --username "${POSTGRES_USER}" \
  --dbname postgres <<'SQL'
\getenv app_db APP_DB_NAME
\getenv app_user APP_DB_USER
\getenv app_password APP_DB_PASSWORD
\getenv migrator_user MIGRATOR_DB_USER
\getenv migrator_password MIGRATOR_DB_PASSWORD

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'migrator_user',
  :'migrator_password'
) \gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'app_user',
  :'app_password'
) \gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'app_db', :'migrator_user') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'app_db') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'app_db', :'app_user') \gexec
SQL

psql \
  --set ON_ERROR_STOP=1 \
  --username "${POSTGRES_USER}" \
  --dbname "${APP_DB_NAME}" <<'SQL'
\getenv app_user APP_DB_USER
\getenv migrator_user MIGRATOR_DB_USER

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user') \gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
  :'migrator_user',
  :'app_user'
) \gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I',
  :'migrator_user',
  :'app_user'
) \gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE ON TYPES TO %I',
  :'migrator_user',
  :'app_user'
) \gexec
SQL
