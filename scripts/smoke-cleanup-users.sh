#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EMAIL_LIKE="${EMAIL_LIKE:-smoke.%@example.com}"
ESCOLA_ID="${ESCOLA_ID:-}"
APPLY=0

usage() {
  cat <<USAGE
Usage:
  scripts/smoke-cleanup-users.sh [--email-like PATTERN] [--escola-id UUID] [--apply]

Default behavior is DRY-RUN (no changes).

Options:
  --email-like PATTERN   SQL ILIKE pattern for candidate profiles.email (default: smoke.%@example.com)
  --escola-id UUID       Optional school scope filter (profiles.escola_id/current_escola_id)
  --apply                Execute cleanup changes (without this flag, only preview)
  -h, --help             Show this help

Environment:
  DB_URL                 Required (loaded from .env.db if present)

Examples:
  scripts/smoke-cleanup-users.sh
  scripts/smoke-cleanup-users.sh --email-like 'smoke.%@example.com' --escola-id '53a6d7df-93b5-4242-b4da-35f70a18cf26'
  scripts/smoke-cleanup-users.sh --apply
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email-like)
      EMAIL_LIKE="$2"
      shift 2
      ;;
    --escola-id)
      ESCOLA_ID="$2"
      shift 2
      ;;
    --apply)
      APPLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERR] Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${DB_URL:-}" ]] && [[ -f .env.db ]]; then
  DB_URL="$(awk -F= '/^DB_URL=/{sub(/^DB_URL=/,""); print; exit}' .env.db | sed 's/^"//;s/"$//')"
fi

if [[ -z "${DB_URL:-}" ]]; then
  echo "[ERR] DB_URL not set. Export DB_URL or create .env.db with DB_URL=..." >&2
  exit 1
fi

echo "[INFO] email_like=${EMAIL_LIKE}"
echo "[INFO] escola_id=${ESCOLA_ID:-<none>}"

db_exec() {
  local sql="$1"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -P pager=off -c "$sql"
}

sql_quote() {
  local raw="$1"
  printf "'%s'" "$(printf "%s" "$raw" | sed "s/'/''/g")"
}

EMAIL_LIKE_SQL="$(sql_quote "$EMAIL_LIKE")"
ESCOLA_ID_SQL="NULL"
if [[ -n "$ESCOLA_ID" ]]; then
  ESCOLA_ID_SQL="$(sql_quote "$ESCOLA_ID")"
fi

PREVIEW_SQL=$(cat <<SQL
WITH candidates AS (
  SELECT
    p.user_id,
    p.email,
    p.escola_id,
    p.current_escola_id,
    EXISTS (SELECT 1 FROM public.audit_logs al WHERE al.user_id = p.user_id) AS has_audit_logs
  FROM public.profiles p
  WHERE COALESCE(p.email, '') ILIKE ${EMAIL_LIKE_SQL}
    AND (
      ${ESCOLA_ID_SQL} IS NULL
      OR p.escola_id::text = ${ESCOLA_ID_SQL}
      OR p.current_escola_id::text = ${ESCOLA_ID_SQL}
    )
)
SELECT
  COUNT(*) AS candidate_profiles,
  COUNT(*) FILTER (WHERE has_audit_logs) AS with_audit_logs,
  COUNT(*) FILTER (WHERE NOT has_audit_logs) AS without_audit_logs,
  (SELECT COUNT(*) FROM public.escola_users eu WHERE eu.user_id IN (SELECT user_id FROM candidates)) AS escola_users_links,
  (SELECT COUNT(*) FROM public.escola_administradores ea WHERE ea.user_id IN (SELECT user_id FROM candidates)) AS escola_admin_links,
  (SELECT COUNT(*) FROM public.teachers t WHERE t.profile_id IN (SELECT user_id FROM candidates)) AS teachers_rows,
  (SELECT COUNT(*) FROM public.professores pr WHERE pr.profile_id IN (SELECT user_id FROM candidates)) AS professores_rows,
  (SELECT COUNT(*)
   FROM public.curso_professor_responsavel cpr
   WHERE cpr.professor_id IN (
     SELECT pr.id FROM public.professores pr WHERE pr.profile_id IN (SELECT user_id FROM candidates)
   )) AS curso_professor_responsavel_rows,
  (SELECT COUNT(*)
   FROM public.teacher_skills ts
   WHERE ts.teacher_id IN (
     SELECT t.id FROM public.teachers t WHERE t.profile_id IN (SELECT user_id FROM candidates)
   )) AS teacher_skills_rows
FROM candidates;
SQL
)

echo "[INFO] Preview of impacted rows"
db_exec "$PREVIEW_SQL"

if [[ $APPLY -eq 0 ]]; then
  echo "[SAFE] Dry-run only. Re-run with --apply to execute cleanup."
  exit 0
fi

APPLY_SQL=$(cat <<SQL
BEGIN;

CREATE TEMP TABLE _smoke_candidates ON COMMIT DROP AS
SELECT
  p.user_id,
  COALESCE(p.email, '') AS email,
  EXISTS (SELECT 1 FROM public.audit_logs al WHERE al.user_id = p.user_id) AS has_audit_logs
FROM public.profiles p
WHERE COALESCE(p.email, '') ILIKE ${EMAIL_LIKE_SQL}
  AND (
    ${ESCOLA_ID_SQL} IS NULL
    OR p.escola_id::text = ${ESCOLA_ID_SQL}
    OR p.current_escola_id::text = ${ESCOLA_ID_SQL}
  );

CREATE TEMP TABLE _smoke_delete_users ON COMMIT DROP AS
SELECT user_id FROM _smoke_candidates WHERE NOT has_audit_logs;

CREATE TEMP TABLE _smoke_keep_users ON COMMIT DROP AS
SELECT user_id FROM _smoke_candidates WHERE has_audit_logs;

DELETE FROM public.teacher_skills ts
USING public.teachers t
WHERE ts.teacher_id = t.id
  AND t.profile_id IN (SELECT user_id FROM _smoke_candidates);

DELETE FROM public.curso_professor_responsavel
WHERE professor_id IN (
  SELECT pr.id FROM public.professores pr WHERE pr.profile_id IN (SELECT user_id FROM _smoke_candidates)
);

DELETE FROM public.professores
WHERE profile_id IN (SELECT user_id FROM _smoke_candidates);

DELETE FROM public.teachers
WHERE profile_id IN (SELECT user_id FROM _smoke_candidates);

DELETE FROM public.escola_administradores
WHERE user_id IN (SELECT user_id FROM _smoke_candidates);

DELETE FROM public.escola_users
WHERE user_id IN (SELECT user_id FROM _smoke_candidates);

-- For users tied to audit logs, preserve referential integrity and anonymize profile.
UPDATE public.profiles p
SET
  nome = 'SMOKE_ANON_' || SUBSTRING(p.user_id::text, 1, 8),
  email = 'anon+smoke+' || SUBSTRING(p.user_id::text, 1, 8) || '@example.invalid',
  email_auth = 'anon+smoke+' || SUBSTRING(p.user_id::text, 1, 8) || '@example.invalid',
  email_real = NULL,
  telefone = NULL,
  numero_processo_login = NULL,
  numero_login = NULL,
  bi_numero = NULL,
  data_nascimento = NULL,
  naturalidade = NULL,
  provincia = NULL,
  encarregado_relacao = NULL,
  avatar_url = NULL,
  global_role = 'guest',
  escola_id = NULL,
  current_escola_id = NULL,
  onboarding_finalizado = false,
  deleted_at = COALESCE(p.deleted_at, NOW()),
  updated_at = NOW()
WHERE p.user_id IN (SELECT user_id FROM _smoke_keep_users);

DELETE FROM public.profiles
WHERE user_id IN (SELECT user_id FROM _smoke_delete_users);

-- Preserve auth.users to avoid FK/rule conflicts in operational tables.
-- Block and anonymize auth users for all candidates.
UPDATE auth.users u
SET
  email = 'anon+smoke+' || SUBSTRING(u.id::text, 1, 8) || '@example.invalid',
  phone = NULL,
  raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'smoke_cleanup', true,
    'anonymized_at', NOW()::text
  ),
  raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'smoke_cleanup', true
  ),
  banned_until = '2099-12-31 00:00:00+00'::timestamptz,
  updated_at = NOW()
WHERE u.id IN (SELECT user_id FROM _smoke_candidates);

SELECT json_build_object(
  'candidates', (SELECT COUNT(*) FROM _smoke_candidates),
  'deleted_profiles', (SELECT COUNT(*) FROM _smoke_delete_users),
  'anonymized_users', (SELECT COUNT(*) FROM _smoke_keep_users),
  'remaining_teacher_rows', (SELECT COUNT(*) FROM public.teachers t WHERE t.profile_id IN (SELECT user_id FROM _smoke_candidates)),
  'remaining_professores_rows', (SELECT COUNT(*) FROM public.professores p WHERE p.profile_id IN (SELECT user_id FROM _smoke_candidates)),
  'remaining_escola_users_rows', (SELECT COUNT(*) FROM public.escola_users eu WHERE eu.user_id IN (SELECT user_id FROM _smoke_candidates))
) AS cleanup_result;

COMMIT;
SQL
)

echo "[APPLY] Executing cleanup transaction..."
db_exec "$APPLY_SQL"
echo "[DONE] Smoke cleanup applied."
