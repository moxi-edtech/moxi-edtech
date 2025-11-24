# Resumo da implementação do wizard de migração de alunos

## Banco de dados
- Migration cria tabelas de suporte (`import_migrations`, `import_errors`, `staging_alunos`), índices obrigatórios e coluna `import_id` em `alunos`.
- Inclui funções de normalização (`normalize_text`, `normalize_date`) e RPC `importar_alunos` para processar staging com RLS liberando service role e staff/admin.

## API Next.js
- Rotas API para upload (`/api/migracao/upload`), validação (`/api/migracao/alunos/validar`) e importação (`/api/migracao/alunos/importar`) usam service role para acessar Supabase, garantir limite de 12 MB, hash do arquivo, staging e execução do RPC.

## Front-end
- Página `/migracao/alunos` implementa um wizard de 4 etapas com upload, mapeamento de colunas, pré-visualização e finalização.
- Componentes reutilizáveis para upload, mapeamento, prévia, erros e progresso; tipagem compartilhada em `types/migracao.ts`.
