#!/bin/bash
echo "🔍 Executando Validador de Fluidez KLASSE"
echo "========================================="

# Carregar variáveis de ambiente
if [ -f .env.validator ]; then
  export $(grep -v '^#' .env.validator | xargs)
  echo "✅ Variáveis de ambiente carregadas"
else
  echo "⚠️  Arquivo .env.validator não encontrado"
  echo "   Usando valores padrão..."
fi

# Executar validador
node tools/validator/fluency-validator-monorepo.js

echo ""
echo "📊 Validação concluída!"
echo "Consulte o relatório em: MONOREPO_VALIDATION_REPORT.md"
