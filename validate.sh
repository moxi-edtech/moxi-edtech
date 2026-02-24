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
