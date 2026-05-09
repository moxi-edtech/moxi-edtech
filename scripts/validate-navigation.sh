#!/bin/bash
set -euo pipefail

# Validates the zero-remount contract for already migrated portal modules.
# Canonical pattern: /escola/[slug]/...
# Short aliases are allowed only as compatibility
# entrypoints or as the path argument to buildPortalHref, not as direct navigation.

PORTAL_PATTERN="admin|secretaria|financeiro|professor|aluno"

echo "Checking Admin/Secretaria/Financeiro/Professor/Aluno canonical navigation..."

DIRECT_SHORT_NAV=$(rg -n "href=\\{?['\"]/($PORTAL_PATTERN)(/|['\"]|\\?)|router\\.(push|replace)\\(\\s*['\"]/($PORTAL_PATTERN)(/|['\"]|\\?)|window\\.location\\.href\\s*=\\s*['\"]/($PORTAL_PATTERN)" \
  apps/web/src/components \
  apps/web/src/hooks \
  apps/web/src/app/admin \
  apps/web/src/app/secretaria \
  apps/web/src/app/financeiro \
  apps/web/src/app/professor \
  'apps/web/src/app/(portal-aluno)' \
  apps/web/src/app/escola \
  apps/web/src/modelo_portal_do_aluno \
  --glob '*.{ts,tsx}' || true)

OBJECT_SHORT_NAV=$(rg -n "\\b(href|link|action_href|route):\\s*['\"]/($PORTAL_PATTERN)(/|['\"]|\\?)" \
  apps/web/src/components \
  apps/web/src/hooks \
  apps/web/src/app/escola \
  --glob '*.{ts,tsx}' || true)

CANONICAL_SHORT_REDIRECTS=$(rg -n "redirect\\(\\s*['\"]/($PORTAL_PATTERN)(/|['\"]|\\?)" \
  apps/web/src/app/escola \
  --glob '*.{ts,tsx}' || true)

MANUAL_CANONICAL_ADMIN=$(rg -n 'href=\{`/escola/\$\{|router\.(push|replace)\(\s*`/escola/\$\{|const [A-Za-z0-9_]+ = `/escola/\$\{[^}]+\}/admin|basePath = `/escola' \
  'apps/web/src/app/escola/[id]/(portal)/admin' \
  apps/web/src/components/layout/escola-admin \
  apps/web/src/components/escola-admin \
  apps/web/src/components/escola/settings \
  --glob '*.{ts,tsx}' || true)

CANONICAL_SHORT_STRINGS=$(rg -n "['\"]/($PORTAL_PATTERN)(/|['\"]|\\?)" \
  'apps/web/src/app/escola/[id]/(portal)/admin' \
  'apps/web/src/app/escola/[id]/(portal)/secretaria' \
  'apps/web/src/app/escola/[id]/(portal)/financeiro' \
  'apps/web/src/app/escola/[id]/professor' \
  'apps/web/src/app/escola/[id]/aluno' \
  --glob '*.{ts,tsx}' \
  | rg -v 'buildPortalHref|baseRaw =|const base = "/admin/configuracoes"|pathname.*includes' || true)

if [ -n "$DIRECT_SHORT_NAV$OBJECT_SHORT_NAV$CANONICAL_SHORT_REDIRECTS$MANUAL_CANONICAL_ADMIN$CANONICAL_SHORT_STRINGS" ]; then
  echo "Found non-canonical navigation:"
  if [ -n "$DIRECT_SHORT_NAV" ]; then
    echo
    echo "[direct short navigation]"
    echo "$DIRECT_SHORT_NAV"
  fi
  if [ -n "$OBJECT_SHORT_NAV" ]; then
    echo
    echo "[object short navigation]"
    echo "$OBJECT_SHORT_NAV"
  fi
  if [ -n "$CANONICAL_SHORT_REDIRECTS" ]; then
    echo
    echo "[canonical short redirects]"
    echo "$CANONICAL_SHORT_REDIRECTS"
  fi
  if [ -n "$MANUAL_CANONICAL_ADMIN" ]; then
    echo
    echo "[manual canonical admin URLs]"
    echo "$MANUAL_CANONICAL_ADMIN"
  fi
  if [ -n "$CANONICAL_SHORT_STRINGS" ]; then
    echo
    echo "[canonical short strings outside helper]"
    echo "$CANONICAL_SHORT_STRINGS"
  fi
  exit 1
fi

echo "OK: migrated portal navigation stays inside /escola/[slug]/..."
