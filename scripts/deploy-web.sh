#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export VERCEL_ORG_ID="team_GkXi2qX0WmXpWQCLtnCWEcfN"
export VERCEL_PROJECT_ID="prj_GOEeUzakrO2xL8Xwe53sE9pGlVgH"

exec vercel deploy --prod --yes --scope moxinexas-projects "$@"
