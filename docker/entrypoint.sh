#!/usr/bin/env bash
set -euo pipefail

# Ensure output directory exists for scan artifacts
mkdir -p "${RESULTS_DIR:-/output}"

exec "$@"
