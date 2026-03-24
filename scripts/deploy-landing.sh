#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/landing"
PROJECT_FILE="$APP_DIR/.vercel/project.json"

if [[ ! -f "$PROJECT_FILE" ]]; then
  echo "Arquivo ausente: $PROJECT_FILE" >&2
  echo "Execute 'vercel link' dentro de apps/landing para vincular o projeto correto." >&2
  exit 1
fi

export VERCEL_ORG_ID="$(
  node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(p.orgId);" "$PROJECT_FILE"
)"
export VERCEL_PROJECT_ID="$(
  node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(p.projectId);" "$PROJECT_FILE"
)"

echo "Deploy LANDING -> org=$VERCEL_ORG_ID project=$VERCEL_PROJECT_ID cwd=$ROOT_DIR"
exec vercel deploy --prod --yes --scope moxinexas-projects --cwd "$ROOT_DIR" "$@"
