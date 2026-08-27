# Aprovação necessária — Sprint 2 RAA — RPCs transacionais

run_id: RAA-SPRINT2-RPC-SSOT-20260815
timestamp: 2026-08-15

## Acção proposta

Fazer com que as operações transacionais de rematrícula e progressão usem a
mesma decisão RAA da API e do portal da secretaria, eliminando a decisão
paralela baseada apenas em `matriculas.status` e `historico_anos.resultado_final`.

Funções abrangidas:

- `public.finalizar_rematricula_balcao`
- `public.promover_aluno_pos_pagamento`
- `public.rematricula_em_massa`

## Diff proposto

```diff
supabase/migrations/<nova_migration>_raa_progression_rpc_ssot.sql

+ CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(
+   p_escola_id uuid,
+   p_matricula_id uuid
+ ) RETURNS jsonb
+ -- valida escola, política RAA, disciplinas, resultado canónico,
+ -- frequência, regime e devolve decision/destino/etapaDestino.
+
+ CREATE OR REPLACE FUNCTION public.finalizar_rematricula_balcao(...)
+ -- chama resolve_raa_progression_for_matricula antes de validar a turma;
+ -- bloqueia decisão pendente, recurso não autorizado e turma incompatível;
+ -- permite a etapa seguinte, mesma etapa ou conclusão conforme o resultado.
+
+ CREATE OR REPLACE FUNCTION public.promover_aluno_pos_pagamento(...)
+ -- chama o mesmo resolver antes de criar a matrícula destino;
+ -- deixa de assumir sempre classe atual + 1.
+
+ CREATE OR REPLACE FUNCTION public.rematricula_em_massa(...)
+ -- resolve cada candidato individualmente dentro da transação;
+ -- inclui o decision RAA em inserted/skipped/errors;
+ -- não promove alunos com política não configurada ou dados pendentes.
```

## Risco

Alto: altera três operações financeiras/académicas transacionais e pode mudar
quais alunos são promovidos, retidos ou colocados em inscrição condicional.
Não deve ser aplicado sem testes SQL numa escola de homologação e validação
explícita da política para classes de exame, recurso, faltas e indisciplina.

## Plano de verificação após aprovação

1. Criar a migration sem alterar dados existentes.
2. Validar as funções com uma matrícula aprovada, retida, em recurso, pendente,
   por faltas e por indisciplina.
3. Confirmar idempotência e rollback transacional.
4. Executar `pnpm -C apps/web typecheck`, testes unitários e `git diff --check`.
5. Só depois avaliar aplicação remota na Escola Klasse.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT2-RPC-SSOT-20260815`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT2-RPC-SSOT-20260815 [motivo]`
