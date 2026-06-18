#!/usr/bin/env bash

# Gray readiness gate for car-shop-cloud.
# Runs the minimum checks required before applying gray-environment migrations
# and exercising the smoke flow. The script is intentionally read-only except
# for tool caches/build outputs created by the underlying commands.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0
warnings=0

print_header() {
  printf '\n========================================\n'
  printf '  %s\n' "$1"
  printf '========================================\n'
}

run_required() {
  local label="$1"
  shift
  print_header "$label"
  printf '+ %q' "$@"
  printf '\n'
  if "$@"; then
    printf '[PASS] %s\n' "$label"
  else
    local code=$?
    printf '[FAIL] %s (exit %s)\n' "$label" "$code" >&2
    failures=$((failures + 1))
  fi
}

run_db_required() {
  local label="$1"
  shift
  if [[ -z "${DATABASE_URL:-}" ]]; then
    print_header "$label"
    printf '[FAIL] DATABASE_URL is required for %s.\n' "$label" >&2
    printf '       Set DATABASE_URL to a reachable PostgreSQL database before gray readiness checks.\n' >&2
    failures=$((failures + 1))
    return
  fi
  run_required "$label" "$@"
}

print_header "Environment"
printf 'Repo: %s\n' "$ROOT_DIR"
printf 'Node: %s\n' "$(node --version 2>/dev/null || printf 'not found')"
printf 'pnpm: %s\n' "$(pnpm --version 2>/dev/null || printf 'not found')"
if [[ -z "${DATABASE_URL:-}" ]]; then
  printf '[WARN] DATABASE_URL is not set; database-backed audits will fail with an actionable message.\n' >&2
  warnings=$((warnings + 1))
else
  printf 'DATABASE_URL: configured\n'
fi

run_required "Git whitespace check" \
  git diff --check

run_required "Prisma client generation" \
  pnpm prisma:generate

run_required "Prisma schema validation" \
  bash -c 'DATABASE_URL="${DATABASE_URL:-postgresql://user:pass@localhost:5432/db}" pnpm --filter @car/api exec prisma validate'

run_required "API build" \
  pnpm build:api

run_required "Gray smoke script compile check" \
  pnpm smoke:gray:check

run_db_required "Login phone uniqueness audit" \
  pnpm audit:login-phones -- --strict

run_db_required "Active customer/vehicle uniqueness audit" \
  pnpm audit:active-uniques -- --strict

run_required "Critical hardening unit tests" \
  pnpm --filter @car/api exec jest \
    src/common/filters/http-exception.filter.spec.ts \
    src/tenant/customer/customer.service.spec.ts \
    src/tenant/vehicle/vehicle.service.spec.ts \
    --runInBand

print_header "Summary"
printf 'Warnings: %s\n' "$warnings"
printf 'Failures: %s\n' "$failures"

if [[ "$failures" -gt 0 ]]; then
  printf 'Gray readiness checks failed. Fix the failures above before migration/smoke execution.\n' >&2
  exit 1
fi

printf 'Gray readiness checks passed.\n'
