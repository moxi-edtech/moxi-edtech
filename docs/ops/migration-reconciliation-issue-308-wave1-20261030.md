# KLASSE — Issue #308 / lote 1: histórico transitado (30/10/2026)

## Evidência verificada

Projeto Supabase: `wjtifcpxxxotsbmvbgoq` (ambiente operacional, sem staging). Base Git: `main` após a PR #307.

Inventário inicial da PR #307: 938 ficheiros locais; 698 registos remotos; 307 versões locais ausentes do ledger; 67 entradas remotas sem ficheiro (58 fiscais).

Após este lote:
- Ledger remoto: **700 registos** (confirmado com `SELECT count(*)`).
- Diretoria `supabase/migrations` após esta branch: **939 ficheiros** (938 - 1 legado arquivado + 2 migrações novas).
- Exceções esperadas após integrar a branch: **306 locais sem versão remota** e **67 remotas sem ficheiro local**; confirmar por novo inventário completo antes de declarar a contagem final.
- A migração `20270618110000_historico_transitado_batch_and_rls_hardening.sql` **não foi aplicada** e foi preservada, sem execução, em `supabase/ops/legacy/` para evitar que as oito substituições de políticas RLS sejam reproduzidas sem revisão.

## Alterações aplicadas e verificadas

1. `20271030235958_restore_secure_historico_transitado_lote_20261030.sql`: RPC `public.upsert_historico_transitado_lote` instalada, com `SECURITY DEFINER`, `search_path=''`, `auth.uid()` obrigatório, validação do tenant e papel, turma e classe da escola, matrícula ativa por aluno, rejeição de duplicados e lote até 500 alunos. A função individual previamente existente continua responsável pelo upsert de cada histórico; o lote mantém a operação numa única transação e regista auditoria.
2. `20271030235959_revoke_historico_transitado_unsafe_grants_20261030.sql`: revogação de `TRUNCATE`, `TRIGGER` e `REFERENCES` de `anon` e `authenticated` nas duas tabelas do histórico. RLS, SELECT e INSERT autorizados permaneceram ativos. O papel `service_role` não foi alterado.
3. Verificação de privilégios por `has_table_privilege` e `has_function_privilege`: `anon` não executa a RPC; `authenticated` pode executá-la e não tem `TRUNCATE` nas duas tabelas.
4. Chamada sem autenticação foi rejeitada (`AUTH:`) em teste negativo sem escrita de dados. Catálogo confirma `SECURITY DEFINER` com `search_path` vazio.
5. Integridade operacional observada após a alteração: 1.115 matrículas e 949 notas; tabelas do histórico transitado permanecem vazias. Estas são contagens pós-operação, não prova de ausência de alterações históricas sem baseline anterior.

## Correção de versão e replay

O conector Supabase gerou inicialmente versões correntes `20261031001438` e `20261031001157`. Como a dependência de fundação tem versão `20270618100000`, esses timestamps produziriam ordem incorreta num replay limpo.

Os **dois registos reais já executados** foram renumerados de forma estritamente guardada, em transações verificadas, para `20271030235958` e `20271030235959`, respetivamente. Cada atualização exigiu nome, versão original, conteúdo SQL esperado e ausência de colisão, afetando exatamente uma linha. Os SQL locais foram conferidos **byte por byte quanto ao texto do statement** com `supabase_migrations.schema_migrations.statements[1]`. Nenhum script foi registado sem execução.

## Ainda não certificado

- **Homologação funcional positiva** da RPC com secretaria/admin de duas escolas, leitura, correção de notas, auditoria, erros, rollback e isolamento. Não há ambiente de staging; não escrever dados de teste na base operacional.
- **Equivalência integral da cadeia histórica** num banco descartável: o repositório ainda contém migrações locais sem proveniência remota. Não inferir replay global seguro deste lote.
- **RLS de históricos**: as oito políticas anteriores permanecem em produção. O script original de reescrita foi arquivado e não substituído por políticas novas; reavaliar separadamente direitos de secretaria/admin/super-admin e acesso direto.
- As demais **306/67** diferenças continuam exigindo comparação por hash e catálogo. **Não** executar `supabase db push`, `--include-all`, `db reset --linked` ou `migration repair` em massa.
- Os 58 payloads fiscais continuam fora do escopo; não exportar SQL fiscal para o repositório nem ativar o motor AGT como efeito colateral.
- O repositório GitHub foi observado como **público**; não copiar conteúdo remoto potencialmente sensível para ficheiros públicos sem auditoria de segredos e proveniência.

## Validação antes de merge

- Executar o guard de migrações; conferir unicidade e ausência de SQL não versionado.
- Inspecionar diff: exatamente duas migrações novas e a migração antiga arquivada, além deste relatório.
- Confirmar CI e atualizar as contagens do inventário contra o ledger remoto.
- Não classificar os contratos como funcionalmente homologados antes de um teste de utilizador autenticado com escola real.
