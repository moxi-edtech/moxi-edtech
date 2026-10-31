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

## Adenda de segurança e CI — 30/10/2026

### CI da PR #309 (HEAD original `45833955236f83c7c7e5226975ffd2b37e37b1f6`)

Todos os 4 workflows inicialmente disparados foram aprovados: Gracefulness Balcao P0, Next.js Route Segment Integrity, KF2 Search Audit e Supabase Migration Ledger Guard. O guard confirmou `939 SQL files, 939 unique versioned migrations, zero rollback files`. **Reexecutar o CI após esta adenda e o terceiro ficheiro SQL.**

### RPC pública de admissões — vulnerabilidade mitigada

`public.admissao_public_lookup_by_protocolo(uuid,text)` devolve campos pessoais da candidatura (`nome_candidato`, `responsavel_contato_normalizado`, `dados_candidato`, etc.) com `SECURITY DEFINER`. Os protocolos públicos novos têm formato sequencial de ano (`YY-NNNN`). A API pública `apps/web/src/app/api/public/admissoes/[escolaSlug]/consultar/route.ts` aplica rate limit e desafio adicional, mas faz o lookup através de `supabaseServerRole()`. O `GRANT` direto anterior a `anon`/`authenticated` permitia contornar esse controlo via PostgREST.

**Correção executada:** `20271031000000_restrict_admission_public_lookup_service_role_only_20261030.sql` revoga `EXECUTE` de `PUBLIC`, `anon`, `authenticated`, preservando `service_role`. Confirmação no catálogo: `anon=false`, `authenticated=false`, `service_role=true`. A versão correspondente do ledger foi reconciliada com precondições de nome, corpo SQL e ausência de colisão. Os payloads pessoais não foram consultados nem exportados.

A rota do servidor deve continuar a funcionar, **mas não existe teste HTTP end-to-end nesta revisão**. Esta correção não resolve eventuais falhas de rate limit no endpoint público ou outros consumidores desconhecidos.

### Isolamento da RPC de histórico — dois contextos escolares

Teste SQL **sem escrita**: foram selecionados funcionários existentes de duas escolas e simuladas as respetivas claims JWT (`sub`, `app_metadata.escola_id`). Em ambos os contextos, a RPC `upsert_historico_transitado_lote` passou a autorização e rejeitou o lote vazio com `DATA:`. O mesmo utilizador tentando enviar `p_escola_id` da outra escola recebeu `AUTH: escola_id inválido`. Foram preservadas as duas tabelas sem registos transitados. **Não equivale** a uma sessão JWT assinada por utilizador real nem certifica escrita de histórico ou RLS via Data API.

### Triagem preliminar de funções públicas

O Security Advisor sinalizou inicialmente 48 funções `SECURITY DEFINER` executáveis por `anon`. Parte são endpoints públicos intencionais (admissões, onboarding, marketing/afiliados), duas são trigger functions e outras são utilitários de auditoria. A função de admissão, pelo retorno de PII com protocolo sequencial, foi classificada de risco imediato e corrigida. Não revogar indiscriminadamente grants de rotas públicas intencionais, nem dar o alerta como inteiramente resolvido sem revisão função-a-função.

### Contagem após terceiro contrato

Ledger remoto esperado e observado após migração de admissões: **701** entradas. Diretoria SQL na branch: **940** ficheiros, todos versionados (aguarda-se CI do novo HEAD). Divergências estimadas: **306 versões locais ausentes do ledger** e **67 entradas remotas sem ficheiro**; um novo inventário independente deve confirmar estes números após merge.

### Limitações e pendências de release

- O repositório está **público**, o que exige decisão de configuração e revisão de integridade dos históricos de commits (não só ficheiros atuais); não mudar sem avaliar integrações e deployment.
- A migração de controlo de acesso das candidaturas já foi instalada no banco; sincronizar a branch/PR com a `main` após CI.
- O teste funcional positivo autenticado do histórico transitado continua pendente, sem escrita de teste na produção.
