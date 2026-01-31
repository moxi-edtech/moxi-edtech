#!/bin/bash
# setup-validator.sh

echo "🚀 Configurando Validador KLASSE Monorepo"

# 1. Criar arquivo de configuração
cat > .env.validator << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=klasse_prod
DB_USER=postgres
DB_PASS=sua_senha_aqui
EOF

echo "✅ Arquivo .env.validator criado"

# 2. Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependências..."
  pnpm install postgres ts-morph glob
fi

# 3. Verificar estrutura do monorepo
echo "📁 Verificando estrutura do monorepo..."
if [ -d "apps" ]; then
  echo "✅ Encontrado diretório apps/"
  APPS_COUNT=$(find apps -maxdepth 1 -type d | wc -l)
  echo "   $((APPS_COUNT - 1)) aplicações encontradas"
fi

if [ -d "packages" ]; then
  echo "✅ Encontrado diretório packages/"
  PACKAGES_COUNT=$(find packages -maxdepth 1 -type d | wc -l)
  echo "   $((PACKAGES_COUNT - 1)) pacotes encontrados"
fi

# 4. Criar script de execução
cat > validate-fluency.sh << 'EOF'
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
node fluency-validator-monorepo.js

echo ""
echo "📊 Validação concluída!"
echo "Consulte o relatório em: MONOREPO_VALIDATION_REPORT.md"
EOF

chmod +x validate-fluency.sh

echo ""
echo "🎯 CONFIGURAÇÃO COMPLETA!"
echo "Para executar o validador:"
echo "  ./validate-fluency.sh"
echo ""
echo "O validador irá:"
echo "  1. Escanear todo o monorepo (apps/, packages/, etc.)"
echo "  2. Verificar segurança multi-tenant"
echo "  3. Validar implementação de endpoints"
echo "  4. Analisar componentes UI"
echo "  5. Gerar relatório detalhado"
