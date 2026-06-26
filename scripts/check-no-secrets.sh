#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

commits_file="$tmpdir/commits.txt"
files_file="$tmpdir/files.txt"
matches_file="$tmpdir/matches.txt"

touch "$commits_file" "$files_file" "$matches_file"

mode="${1:-push}"

if [[ "$mode" == "--all" ]]; then
  git rev-list --all >"$commits_file"
else
  while read -r local_ref local_sha remote_ref remote_sha; do
    if [[ -z "${local_ref:-}" ]]; then
      continue
    fi

    if [[ "$local_sha" =~ ^0+$ ]]; then
      continue
    fi

    if [[ "$remote_sha" =~ ^0+$ ]]; then
      git rev-list "$local_sha" >>"$commits_file"
    elif git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
      git rev-list "${remote_sha}..${local_sha}" >>"$commits_file"
    else
      # If local history was rewritten and the advertised remote tip is not an ancestor,
      # scan the whole local tip being pushed instead of failing on an invalid range.
      git rev-list "$local_sha" >>"$commits_file"
    fi
  done
fi

sort -u "$commits_file" -o "$commits_file"

if [[ ! -s "$commits_file" ]]; then
  exit 0
fi

SECRET_REGEX='(postgresql://[^[:space:]'"'"'"<>]+:[^[:space:]'"'"'"<>@]+@|sb_secret_[A-Za-z0-9_-]{8,}|sb_publishable_[A-Za-z0-9_-]{8,}|service_role[^[:space:]'"'"'"<>]{8,}|-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|sk_(live|test)_[0-9A-Za-z]{16,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,})'

ALLOWLIST_REGEX='(<PASSWORD>|<project-ref>|<region>|postgresql://postgres\.<project-ref>:<PASSWORD>@aws-1-<region>\.pooler\.supabase\.com:6543/postgres(\?sslmode=require)?|postgresql://postgres\.<project-ref>:<PASSWORD>@aws-1-<region>\.pooler\.supabase\.com:5432/postgres(\?sslmode=require)?|sb-project-ref-auth-token|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ANON_KEY|WAHA_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|SUPABASE_PROJECT_REF|PROJECT_REF)'

while read -r commit; do
  git diff-tree --no-commit-id --name-only -r "$commit" >>"$files_file"
done <"$commits_file"

sort -u "$files_file" -o "$files_file"

while read -r commit; do
  while read -r path; do
    [[ -n "$path" ]] || continue
    if ! git cat-file -e "${commit}:${path}" 2>/dev/null; then
      continue
    fi

    if git show "${commit}:${path}" | LC_ALL=C grep -nE "$SECRET_REGEX" | LC_ALL=C grep -Ev "$ALLOWLIST_REGEX" >"$tmpdir/current.txt"; then
      while read -r line; do
        printf '%s:%s:%s\n' "$commit" "$path" "$line" >>"$matches_file"
      done <"$tmpdir/current.txt"
    fi
  done <"$files_file"
done <"$commits_file"

if [[ -s "$matches_file" ]]; then
  echo "[BLOCKED] push rejeitado: possível segredo detectado nos commits enviados." >&2
  echo >&2
  sed -n '1,20p' "$matches_file" >&2
  echo >&2
  echo "Revise os ficheiros acima, remova o segredo do commit e tente de novo." >&2
  echo "Se for placeholder/documentação legítima, ajuste o allowlist em scripts/check-no-secrets.sh com critério estrito." >&2
  exit 1
fi

exit 0
