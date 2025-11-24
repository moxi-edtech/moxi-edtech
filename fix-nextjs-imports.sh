#!/bin/bash
echo "🔧 Aplicando correções para importações Next.js..."

# Lista de arquivos suspeitos
FILES=(
  "apps/web/src/app/secretaria/(portal-secretaria)/alunos/novo/page.tsx"
  "apps/web/src/app/secretaria/(portal-secretaria)/matriculas/nova/page.tsx" 
  "apps/web/src/app/financeiro/layout.tsx"
  "apps/web/src/app/financeiro/page.tsx"
  "apps/web/src/app/super-admin/escolas/nova/page.tsx"
  "apps/web/src/app/super-admin/fluxos/criacao-admin/page.tsx"
  "apps/web/src/app/super-admin/usuarios/novo/page.tsx"
  "apps/web/src/app/super-admin/layout.tsx"
  "apps/web/src/app/escola/[id]/alunos/page.tsx"
  "apps/web/src/app/escola/[id]/turmas/page.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Verificando $file"
    # Remover importações problemáticas de next/document
    sed -i.bak '/from.*next.document/d' "$file"
    # Remover uso de tags document do Next.js
    sed -i.bak 's/<Html[^>]*>//g; s/<\/Html>//g; s/<Head[^>]*>//g; s/<\/Head>//g; s/<Main[^>]*>//g; s/<\/Main>//g; s/<NextScript[^>]*>//g' "$file"
    rm -f "$file.bak"
  fi
done

echo "✅ Correções aplicadas!"
