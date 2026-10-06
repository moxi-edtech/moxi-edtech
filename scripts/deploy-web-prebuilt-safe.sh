#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/web"
PROJECT_FILE="$APP_DIR/.vercel/project.json"

EXPECTED_PROJECT_ID="prj_YjDBpI3emmjWUB5cF7K7IsV7oNFg"
EXPECTED_ORG_ID="team_GkXi2qX0WmXpWQCLtnCWEcfN"
VERCEL_SCOPE="${VERCEL_SCOPE:-moxinexas-projects}"
GIT_REMOTE_URL="${KLASSE_GIT_REMOTE_URL:-https://github.com/moxi-edtech/moxi-edtech.git}"
PRODUCTION_DOMAIN="${KLASSE_PRODUCTION_DOMAIN:-app.klasse.ao}"
DRY_RUN="${KLASSE_DEPLOY_DRY_RUN:-0}"
FORCE_REDEPLOY="${KLASSE_FORCE_REDEPLOY:-0}"

WORKTREE=""
PROMOTED=0
SUCCESS=0
PREVIOUS_DEPLOYMENT_URL=""

log() {
  printf '[klasse-prebuilt] %s\n' "$*"
}

die() {
  printf '[klasse-prebuilt] ERRO: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "comando obrigatório ausente: $1"
}

cleanup() {
  if [[ -n "$WORKTREE" && -d "$WORKTREE" ]]; then
    git -C "$ROOT_DIR" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
    rm -rf "$WORKTREE" >/dev/null 2>&1 || true
  fi
}

on_exit() {
  local status=$?
  if [[ "$status" -ne 0 && "$PROMOTED" -eq 1 && -n "$PREVIOUS_DEPLOYMENT_URL" ]]; then
    printf '[klasse-prebuilt] Falha após promoção; restaurando %s\n' "$PREVIOUS_DEPLOYMENT_URL" >&2
    vercel promote "$PREVIOUS_DEPLOYMENT_URL" \
      --yes \
      --timeout 5m \
      --scope "$VERCEL_SCOPE" >/dev/null 2>&1 || \
      printf '[klasse-prebuilt] ATENÇÃO: rollback automático falhou; restaure %s manualmente.\n' "$PREVIOUS_DEPLOYMENT_URL" >&2
  fi
  cleanup
  if [[ "$SUCCESS" -ne 1 ]]; then
    exit "$status"
  fi
}

trap on_exit EXIT

for cmd in git node pnpm vercel curl mktemp; do
  need_cmd "$cmd"
done

[[ -f "$PROJECT_FILE" ]] ||   die "arquivo ausente: $PROJECT_FILE. Execute 'vercel link' em apps/web."

VERCEL_PROJECT_ID="$(node -e 'const p=require(process.argv[1]); process.stdout.write(p.projectId || "")' "$PROJECT_FILE")"
VERCEL_ORG_ID="$(node -e 'const p=require(process.argv[1]); process.stdout.write(p.orgId || "")' "$PROJECT_FILE")"
VERCEL_PROJECT_NAME="$(node -e 'const p=require(process.argv[1]); process.stdout.write(p.projectName || "")' "$PROJECT_FILE")"

[[ "$VERCEL_PROJECT_ID" == "$EXPECTED_PROJECT_ID" ]] ||   die "projectId inesperado ($VERCEL_PROJECT_ID). Recusando tocar produção."
[[ "$VERCEL_ORG_ID" == "$EXPECTED_ORG_ID" ]] ||   die "orgId inesperado ($VERCEL_ORG_ID). Recusando tocar produção."
[[ "$VERCEL_PROJECT_NAME" == "moxi-edtech" ]] ||   die "projeto inesperado ($VERCEL_PROJECT_NAME). Esperado: moxi-edtech."

export VERCEL_PROJECT_ID
export VERCEL_ORG_ID

log "alvo Vercel validado: moxi-edtech -> $PRODUCTION_DOMAIN"

DEPLOY_MAIN_REF="refs/remotes/klasse-deploy/main"
git -C "$ROOT_DIR" fetch "$GIT_REMOTE_URL" "main:$DEPLOY_MAIN_REF" --force --quiet

TARGET_REF="$DEPLOY_MAIN_REF"
if [[ "$DRY_RUN" == "1" && -n "${KLASSE_TARGET_REF:-}" ]]; then
  TARGET_REF="$KLASSE_TARGET_REF"
elif [[ -n "${KLASSE_TARGET_REF:-}" ]]; then
  die "KLASSE_TARGET_REF só é permitido com KLASSE_DEPLOY_DRY_RUN=1"
fi

TARGET_SHA="$(git -C "$ROOT_DIR" rev-parse "$TARGET_REF^{commit}")"
log "commit alvo: $TARGET_SHA ($TARGET_REF)"

PRODUCTION_SHA=""
PREVIOUS_DEPLOYMENT_ID=""

if [[ "$DRY_RUN" == "1" && -n "${KLASSE_PRODUCTION_SHA_OVERRIDE:-}" ]]; then
  PRODUCTION_SHA="$KLASSE_PRODUCTION_SHA_OVERRIDE"
  PREVIOUS_DEPLOYMENT_ID="dry-run"
  PREVIOUS_DEPLOYMENT_URL="https://dry-run.invalid"
  log "dry-run: SHA de produção fornecido para teste: $PRODUCTION_SHA"
else
  [[ -z "${KLASSE_PRODUCTION_SHA_OVERRIDE:-}" ]] ||     die "KLASSE_PRODUCTION_SHA_OVERRIDE é proibido fora de dry-run"

  PROD_JSON="$(
    vercel api "/v6/deployments?projectId=$VERCEL_PROJECT_ID&target=production&state=READY&limit=1&teamId=$VERCEL_ORG_ID"       --scope "$VERCEL_SCOPE"
  )" || die "não foi possível consultar o deployment READY atual da produção"

  PRODUCTION_SHA="$(
    printf '%s' "$PROD_JSON" | node -e '
      let input="";
      process.stdin.on("data", c => input += c);
      process.stdin.on("end", () => {
        const d = JSON.parse(input).deployments?.[0];
        if (!d) process.exit(2);
        const meta = d.meta || {};
        process.stdout.write(meta.klasseSourceSha || meta.githubCommitSha || "");
      });
    '
  )" || die "não foi possível obter o SHA atualmente em produção"

  PREVIOUS_DEPLOYMENT_ID="$(
    printf '%s' "$PROD_JSON" | node -e '
      let input="";
      process.stdin.on("data", c => input += c);
      process.stdin.on("end", () => {
        const d = JSON.parse(input).deployments?.[0];
        if (!d) process.exit(2);
        process.stdout.write(d.uid || d.id || "");
      });
    '
  )" || die "não foi possível obter o deployment atual"

  PREVIOUS_DEPLOYMENT_URL="$(
    printf '%s' "$PROD_JSON" | node -e '
      let input="";
      process.stdin.on("data", c => input += c);
      process.stdin.on("end", () => {
        const d = JSON.parse(input).deployments?.[0];
        if (!d?.url) process.exit(2);
        process.stdout.write("https://" + d.url);
      });
    '
  )" || die "não foi possível obter a URL do deployment atual"
fi

[[ -n "$PRODUCTION_SHA" ]] ||   die "deployment atual não informa SHA; abortando para não arriscar regressão"

if ! git -C "$ROOT_DIR" cat-file -e "$PRODUCTION_SHA^{commit}" 2>/dev/null; then
  git -C "$ROOT_DIR" fetch "$GIT_REMOTE_URL" "$PRODUCTION_SHA" --quiet || true
fi

git -C "$ROOT_DIR" cat-file -e "$PRODUCTION_SHA^{commit}" 2>/dev/null ||   die "SHA atualmente em produção não existe no repositório local: $PRODUCTION_SHA"

if ! git -C "$ROOT_DIR" merge-base --is-ancestor "$PRODUCTION_SHA" "$TARGET_SHA"; then
  die "REGRESSÃO BLOQUEADA: produção $PRODUCTION_SHA não é ancestral do alvo $TARGET_SHA"
fi

log "guarda anti-regressão OK: produção $PRODUCTION_SHA está contida no alvo $TARGET_SHA"

if [[ "$TARGET_SHA" == "$PRODUCTION_SHA" && "$FORCE_REDEPLOY" != "1" ]]; then
  log "produção já corresponde ao alvo. Nada a publicar."
  SUCCESS=1
  exit 0
fi

if [[ "$DRY_RUN" == "1" ]]; then
  log "dry-run concluído antes de qualquer build/upload."
  SUCCESS=1
  exit 0
fi

WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/klasse-prebuilt-prod.XXXXXX")"
rm -rf "$WORKTREE"
git -C "$ROOT_DIR" worktree add --detach "$WORKTREE" "$TARGET_SHA" >/dev/null

mkdir -p "$WORKTREE/apps/web/.vercel"
cp "$PROJECT_FILE" "$WORKTREE/apps/web/.vercel/project.json"

for env_file in .env.local .env.production.local; do
  if [[ -f "$APP_DIR/$env_file" ]]; then
    cp "$APP_DIR/$env_file" "$WORKTREE/apps/web/$env_file"
  fi
done

log "worktree isolado criado em $WORKTREE"

(
  cd "$WORKTREE"
  pnpm install --frozen-lockfile
  pnpm -C apps/web typecheck
  pnpm check:ui-standards
  pnpm test:security
)

log "gates locais aprovados; iniciando build Vercel local"

vercel build   --prod   --yes   --scope "$VERCEL_SCOPE"   --cwd "$WORKTREE"

[[ -f "$WORKTREE/.vercel/output/config.json" ]] ||   die "vercel build terminou sem gerar .vercel/output/config.json"

DEPLOY_LOG="$WORKTREE/.klasse-prebuilt-deploy.log"

set +e
vercel deploy   --prebuilt   --archive=tgz   --yes   --scope "$VERCEL_SCOPE"   --cwd "$WORKTREE"   --meta "klasseSourceSha=$TARGET_SHA"   --meta "githubCommitSha=$TARGET_SHA"   --meta "githubCommitRef=main"   2>&1 | tee "$DEPLOY_LOG"
DEPLOY_RC=${PIPESTATUS[0]}
set -e

[[ "$DEPLOY_RC" -eq 0 ]] || die "upload prebuilt falhou"

PREVIEW_URL="$(
  grep -Eo 'https://[A-Za-z0-9._-]+\.vercel\.app' "$DEPLOY_LOG" | tail -n 1
)"

[[ -n "$PREVIEW_URL" ]] ||   die "não foi possível identificar a URL do deployment prebuilt"

log "deployment prebuilt criado: $PREVIEW_URL"

vercel inspect "$PREVIEW_URL"   --wait   --scope "$VERCEL_SCOPE" >/dev/null

log "smoke do artefato antes da promoção"

vercel curl /   --deployment "$PREVIEW_URL"   --scope "$VERCEL_SCOPE" >/dev/null

vercel curl /secretaria/balcao   --deployment "$PREVIEW_URL"   --scope "$VERCEL_SCOPE" >/dev/null

log "artefato READY e smoke aprovado; promovendo para $PRODUCTION_DOMAIN"

vercel promote "$PREVIEW_URL"   --yes   --timeout 5m   --scope "$VERCEL_SCOPE" >/dev/null

PROMOTED=1

check_http() {
  local path="$1"
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "https://$PRODUCTION_DOMAIN$path")"
  if [[ ! "$status" =~ ^(2|3)[0-9][0-9]$ ]]; then
    die "smoke de produção falhou em $path (HTTP $status)"
  fi
  log "smoke produção $path -> HTTP $status"
}

check_http "/"
check_http "/secretaria/balcao"

ACTIVE_JSON="$(
  vercel api "/v13/deployments/$PRODUCTION_DOMAIN?withGitRepoInfo=true&teamId=$VERCEL_ORG_ID"     --scope "$VERCEL_SCOPE"
)" || die "não foi possível verificar o deployment ativo após promoção"

ACTIVE_SHA="$(
  printf '%s' "$ACTIVE_JSON" | node -e '
    let input="";
    process.stdin.on("data", c => input += c);
    process.stdin.on("end", () => {
      const d = JSON.parse(input);
      const meta = d.meta || {};
      process.stdout.write(meta.klasseSourceSha || meta.githubCommitSha || "");
    });
  '
)"

[[ "$ACTIVE_SHA" == "$TARGET_SHA" ]] ||   die "verificação final falhou: ativo=$ACTIVE_SHA esperado=$TARGET_SHA"

log "produção confirmada em $TARGET_SHA; deployment anterior preservado para rollback: $PREVIOUS_DEPLOYMENT_ID"

PROMOTED=0
SUCCESS=1
