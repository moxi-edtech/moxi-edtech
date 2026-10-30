# KLASSE — Migrações Git × Supabase: auditoria global (30/10/2026)

## Estado e origem

- Repositório: `moxi-edtech/moxi-edtech`, base `main` no merge `3739c9ab785766edb6b3e135397ee86f481ce74b`.
- Projeto Supabase analisado: `wjtifcpxxxotsbmvbgoq` (ambiente operacional; **sem staging**).
- Inventário completo sem SQL privado: `supabase/ops/reports/migration-ledger-exceptions-20261030.json`. Cada entrada contém identificador, nome e hash SHA-256 do payload/fonte; **não contém credenciais, chaves ou o SQL fiscal**.
- **Após as correções SQL já aplicadas** e a limpeza de duplicações no código: **938** migrações locais versionadas; **698** registos remotos; **307** ficheiros locais sem versão no ledger; **67** entradas remotas sem ficheiro local.
- As contagens são diferenças de **identificadores**, não provas de que os efeitos SQL estejam ausentes. Não é correcto somar essas duas listas como "374 migrações pendentes de execução".

## O que foi efetivamente corrigido

1. **Seis colisões de timestamp** eliminadas sem modificar o corpo SQL. Quatro ficheiros receberam versões únicas (`20260520004001`, `20260821120001`, `20260827170001`, `20261218100001`). O rollback de mensalidades foi movido para `supabase/ops/rollback/`. Um contrato antigo da restrição de número/status de matrícula foi preservado em `supabase/ops/legacy/` porque reintroduzia aliases `ativa`/`active`, incompatíveis com o estado canónico persistido pelo contrato v3.
2. O script histórico sem versão `MIGRATION_ADMISSAO_P0.sql` foi arquivado em `supabase/ops/legacy/`, evitando que volte a ser confundido com uma migração compatível com Supabase CLI. O teste `balcao_full_replay_assert.py` foi alinhado para rejeitar qualquer SQL não versionado em `supabase/migrations`.
3. `scripts/ci/check-supabase-migration-ledger.mjs` e o workflow `Supabase Migration Ledger Guard` impedem futuras colisões, SQL não versionado e rollbacks dentro da diretoria de migrações. Verificação local: **938/938 identificadores únicos**.
4. Migração **`20270519194000_create_system_maintenance_windows.sql`** aplicada ao Supabase; objeto e quatro políticas RLS verificados. A API do super-admin já consultava uma tabela ausente.
5. Migração **`20260808120000_add_mensalidade_integrity_report.sql`** endurecida antes de aplicar: verificação da escola/ano, permissões financeiras/secretaria ou serviço autorizado, `SECURITY DEFINER` com `search_path` controlado, revogação de `anon`. O endpoint de reconciliação dependia de RPC ausente. Teste negativo autenticado sem escopo válido rejeitado; `anon` sem `EXECUTE`.
6. As duas novas migrações receberam os seus timestamps originais no ledger, sem reexecutar SQL. Script de reconciliação de histórico: `scripts/ops/reconcile-applied-missing-contracts-20261030.sql`.

**Os outros 307 ficheiros e 67 registos não foram marcados artificialmente como aplicados e não foram reexecutados.**

## Risco residual e evidência

- Dos **307** ficheiros locais sem versão remota: **166** contêm `SECURITY DEFINER`, **130** contêm instruções de escrita de dados, **80** contêm `DROP` e **38** contêm criação de políticas RLS. As categorias sobrepõem-se; os números não são aditivos.
- Dos **67** registos exclusivos do Supabase, **58** têm prefixo `bill_` ou `fiscal_`. São alterações fiscais/AGT aplicadas diretamente ao remoto; não importar nem reexecutar o seu código sem revisão específica de compatibilidade e ativação fiscal. Os outros nove são operações de pagamentos/recibos, Command Center, matrícula, transferência e calendário MED.
- Uma análise limitada dos SQL locais identificou **49** declarações de criação de tabela distintas; **48 já existiam** no catálogo antes desta intervenção e a 49.ª (`system_maintenance_windows`) foi instalada. Isso **não comprova** a aplicação integral de cada ficheiro, nem a equivalência das funções/constraints/RLS.
- Há ainda duas RPCs não encontradas no catálogo, declaradas em `20270618110000_historico_transitado_batch_and_rls_hardening.sql`: `can_manage_historico_transitado` e `upsert_historico_transitado_lote`. A segunda é chamada pela API de histórico transitado. Não se executou esta migração porque modifica RLS de históricos e oferece escrita administrativa; requer homologação da política de acesso e contrato de auditoria antes de ir para produção.
- O SQL remoto tem payloads que não correspondem integralmente a ficheiros locais, pelo que um simples `migration repair`/atualização de versão não seria prova suficiente.

## Próximo procedimento seguro

1. **Bloquear `supabase db push` e `--include-all`** neste projeto enquanto as 307/67 diferenças não estiverem classificadas. Não criar migrações placeholder com apenas comentários para esconder registos remotos.
2. Comparar cada ficheiro local com o estado do objeto real, incluindo **assinatura e corpo** das funções, constraints, triggers e políticas. Existência por nome, isoladamente, não basta.
3. Se houver SQL local e remoto com payload exatamente equivalente, conciliar o timestamp com hash e transação protegida, sem reexecutar.
4. Para migrações realmente não aplicadas, isolar efeitos sobre dados e permissões, definir ordem de dependências e executar apenas após revisão de segurança e preflight.
5. Reconstruir a proveniência dos 67 SQL remotos em **artefacto separado de replay**, com revisão jurídica/fiscal para os 58 fiscais. Só depois decidir que scripts são válidos para reprodução em novas bases.
6. Manter validação de multi-tenant/RLS, contagens académicas e integridade de recibos a cada lote.

Este relatório documenta avanços verificáveis; **não declara que a divergência global 307/67 esteja resolvida**.
