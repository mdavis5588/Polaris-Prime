#!/usr/bin/env bash
# Creates a read-only Postgres role on the SAM-tool (Helios) database for
# Polaris Prime's sam-pricing backend plugin to use. Run this against the
# SAM-tool database — NOT against Polaris Prime's own database — as a
# role with privilege to grant access (e.g. the database owner).
#
# Usage:
#   SAM_TOOL_DB_HOST=<host> \
#   SAM_TOOL_DB_PORT=<port> \      # defaults to 5432
#   SAM_TOOL_DB_NAME=<database> \
#   PGPASSWORD=<admin password> \
#     ./scripts/create_sam_tool_readonly_user.sh <admin_user> <new_readonly_user> <new_readonly_password>
#
# Example:
#   SAM_TOOL_DB_HOST=sam-tool-db.internal \
#   SAM_TOOL_DB_NAME=samtool \
#   PGPASSWORD='admin-password-here' \
#     ./scripts/create_sam_tool_readonly_user.sh postgres polaris_readonly 'a-strong-password'
#
# The resulting user/password are what you set as SAM_TOOL_DB_READONLY_USER
# and SAM_TOOL_DB_READONLY_PASSWORD for Polaris Prime itself (see README.md).

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <admin_user> <new_readonly_user> <new_readonly_password>" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but not found on PATH." >&2
  exit 1
fi

ADMIN_USER="$1"
RO_USER="$2"
RO_PASSWORD="$3"

: "${SAM_TOOL_DB_HOST:?Set SAM_TOOL_DB_HOST}"
: "${SAM_TOOL_DB_PORT:=5432}"
: "${SAM_TOOL_DB_NAME:?Set SAM_TOOL_DB_NAME}"
: "${PGPASSWORD:?Set PGPASSWORD to the admin user's password}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

psql "host=${SAM_TOOL_DB_HOST} port=${SAM_TOOL_DB_PORT} dbname=${SAM_TOOL_DB_NAME} user=${ADMIN_USER}" \
  -v ON_ERROR_STOP=1 \
  -v ro_user="${RO_USER}" \
  -v ro_password="${RO_PASSWORD}" \
  -v db_name="${SAM_TOOL_DB_NAME}" \
  -f "${SCRIPT_DIR}/create_sam_tool_readonly_user.sql"

echo
echo "Done. Set these for Polaris Prime's backend:"
echo "  SAM_TOOL_DB_HOST=${SAM_TOOL_DB_HOST}"
echo "  SAM_TOOL_DB_PORT=${SAM_TOOL_DB_PORT}"
echo "  SAM_TOOL_DB_NAME=${SAM_TOOL_DB_NAME}"
echo "  SAM_TOOL_DB_READONLY_USER=${RO_USER}"
echo "  SAM_TOOL_DB_READONLY_PASSWORD=<the password you passed in>"
