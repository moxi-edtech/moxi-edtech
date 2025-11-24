Supabase: Pull Remoto – Guia Rápido

- Pré‑requisitos
  - Docker Desktop instalado (não é necessário iniciar serviços locais para o pull remoto).
  - Supabase CLI instalado e com login ativo: `supabase login`.
  - Projeto linkado ou defina `PROJECT_REF`.

- Script
  - `bash scripts/supabase-pull-remote.sh`
  - Variáveis úteis:
    - `PROJECT_REF`: referência do projeto Supabase (ex.: wjtifcpxxxotsbmvbgoq).
    - `SCHEMAS`: schemas a incluir (padrão: `public,graphql_public`).
    - `SUPABASE_PROFILE`: perfil da CLI (padrão: `supabase`).
    - `DB_URL`: opcional, puxa de uma URL direta.
    - `SKIP_TOGGLE`: se setado, não altera config.toml (avançado).

- NPM scripts
  - `npm run db:pull:remote`
  - `npm run db:pull:remote:schemas` (usa `public,graphql_public`).

- O que o script faz
  - Verifica login e link do projeto.
  - Desabilita temporariamente `realtime` e `storage` em `supabase/config.toml` para evitar erros conhecidos durante o pull.
  - Executa `supabase db pull` apenas do projeto remoto.
  - Restaura `config.toml` e mostra a última migração gerada.

- Saídas
  - Migrações em `supabase/migrations/*.sql`. O arquivo mais recente é impresso ao final.

