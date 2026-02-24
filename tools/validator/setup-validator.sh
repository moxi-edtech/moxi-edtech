#!/bin/bash
# setup-validator.sh — KLASSE Validador de Contratos v1.1
# Alinhado com: big-tech-performance v1.1, AGENT_INSTRUCTIONS v1.2, FEATURES_PRIORITY v1.2

set -e

echo "🚀 KLASSE — Configurando Validador de Contratos v1.1"
echo "====================================================="

# ─── 1. Verificar root do monorepo ────────────────────────────────────────────

if [ ! -d "apps" ] && [ ! -d "supabase" ]; then
  echo "❌ Erro: execute este script na raiz do monorepo (onde estão apps/ e supabase/)"
  exit 1
fi

echo "✅ Raiz do monorepo detectada"

# ─── 2. Criar .env.validator (não sobrescreve se já existe) ───────────────────

if [ ! -f ".env.validator" ]; then
  cat > .env.validator << 'EOF'
# KLASSE Validator — configuração de ambiente
# Não commitar este ficheiro (.gitignore recomendado)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=klasse_prod
DB_USER=postgres
DB_PASS=sua_senha_aqui
EOF
  echo "✅ .env.validator criado — edita DB_PASS antes de executar"
else
  echo "ℹ️  .env.validator já existe — mantido sem alterações"
fi

# ─── 3. Verificar package manager ────────────────────────────────────────────

if command -v pnpm &> /dev/null; then
  PKG="pnpm"
elif command -v npm &> /dev/null; then
  PKG="npm"
else
  echo "❌ Erro: pnpm ou npm não encontrado"
  exit 1
fi

echo "✅ Package manager: $PKG"

# ─── 4. Verificar/criar package.json para o validador ────────────────────────

if [ ! -f "validator-package.json" ]; then
  cat > validator-package.json << 'EOF'
{
  "name": "klasse-validator",
  "version": "1.1.0",
  "type": "module",
  "dependencies": {
    "glob": "^11.0.0"
  }
}
EOF
  echo "✅ validator-package.json criado"
fi

# ─── 5. Instalar dependências do validador ────────────────────────────────────

echo "📦 A verificar dependências..."

# Verificar se glob está disponível (já pode estar no monorepo)
if [ -f "node_modules/glob/dist/esm/index.js" ] || [ -f "node_modules/.pnpm/glob@11.0.0/node_modules/glob/dist/esm/index.js" ]; then
  echo "ℹ️  glob já disponível no monorepo"
else
  echo "📦 A instalar glob..."
  if [ "$PKG" = "pnpm" ]; then
    pnpm add -w glob --save-dev 2>/dev/null || $PKG install glob 2>/dev/null || true
  else
    $PKG install glob --save-dev 2>/dev/null || true
  fi
fi

# ─── 6. Copiar ficheiro principal do validador ────────────────────────────────

VALIDATOR_PATH="tools/validator/fluency-validator-monorepo.js"

if [ ! -f "$VALIDATOR_PATH" ]; then
  echo "❌ Erro: $VALIDATOR_PATH não encontrado"
  echo "   Certifica-te de que o ficheiro existe nesse caminho"
  exit 1
fi

echo "✅ $VALIDATOR_PATH encontrado"

# ─── 7. Criar script de execução ─────────────────────────────────────────────

cat > validate.sh << 'SCRIPT'
#!/bin/bash
# validate.sh — executa o validador KLASSE

set -e

echo "🔍 KLASSE — Validador de Contratos"
echo "===================================="

VALIDATOR_PATH="tools/validator/fluency-validator-monorepo.js"

# Carregar env
if [ -f .env.validator ]; then
  set -a
  source .env.validator
  set +a
  echo "✅ .env.validator carregado"
else
  echo "⚠️  .env.validator não encontrado — a usar defaults"
fi

# Verificar Node.js >= 18 (ESM nativo)
NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Erro: Node.js >= 18 necessário (tens v$(node -v))"
  exit 1
fi

# Executar
echo "🚀 A executar validação..."
node --experimental-vm-modules "$VALIDATOR_PATH"

echo ""
echo "📋 Relatórios gerados:"
echo "   - MONOREPO_VALIDATION_REPORT.md (legível)"
echo "   - REPORT_SCAN_LIVE.json (para ferramentas)"
SCRIPT

chmod +x validate.sh
echo "✅ validate.sh criado"

# ─── 8. Adicionar ao .gitignore ───────────────────────────────────────────────

if [ -f ".gitignore" ]; then
  GITIGNORE_ENTRIES=(
    ".env.validator"
    "REPORT_SCAN_LIVE.json"
    "validator-package.json"
  )
  for entry in "${GITIGNORE_ENTRIES[@]}"; do
    if ! grep -qF "$entry" .gitignore; then
      echo "$entry" >> .gitignore
      echo "✅ $entry adicionado ao .gitignore"
    fi
  done
fi

# ─── 9. Verificar estrutura do monorepo ───────────────────────────────────────

echo ""
echo "📁 Estrutura do monorepo:"

if [ -d "apps" ]; then
  APPS_COUNT=$(find apps -maxdepth 1 -type d | wc -l)
  echo "   apps/        — $((APPS_COUNT - 1)) aplicações"
fi

if [ -d "packages" ]; then
  PACKAGES_COUNT=$(find packages -maxdepth 1 -type d | wc -l)
  echo "   packages/    — $((PACKAGES_COUNT - 1)) pacotes"
fi

if [ -d "supabase/migrations" ]; then
  MIGRATIONS_COUNT=$(find supabase/migrations -name "*.sql" | wc -l)
  echo "   migrations/  — $MIGRATIONS_COUNT ficheiros SQL"
fi

API_COUNT=$(find apps/web/src/app/api -name "route.ts" 2>/dev/null | wc -l || echo 0)
echo "   api routes   — $API_COUNT route.ts"

COMPONENTS_COUNT=$(find apps/web/src/components -name "*.tsx" 2>/dev/null | wc -l || echo 0)
echo "   components   — $COMPONENTS_COUNT .tsx"

# ─── 10. Sumário final ────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 CONFIGURAÇÃO COMPLETA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Para executar a validação:"
echo "  ./validate.sh"
echo ""
echo "O validador verifica (alinhado com contratos v1.1/v1.2):"
echo "  [SHARED-P0.3]      Service Role em endpoints humanos"
echo "  [PILAR-A]          count: 'exact' em produção"
echo "  [PILAR-C]          force-cache em rotas operacionais"
echo "  [NO_STORE_AUDIT]   cache: no-store vs revalidate por tipo de dado"
echo "  [MV_CHECK]         MVs com INDEX + refresh + wrapper + cron"
echo "  [PLAN_GUARD]       Guards de plano: backend E UI em simultâneo"
echo "  [GF4]              Audit Trail: cobertura + schema padronizado"
echo "  [KF2]              Pesquisa Global: debounce + limit + min chars"
echo "  [PILAR-C-SPINNER]  Spinner global em páginas de trabalho"
echo "  [PILAR-B]          Idempotency-Key em mutations críticas"
echo ""
echo "Relatórios:"
echo "  MONOREPO_VALIDATION_REPORT.md — legível por humanos"
echo "  REPORT_SCAN_LIVE.json         — compatível com REPORT_SCAN.json"
echo ""
