# Aprovação necessária — RAA Sprint 0

run_id:  7C91E4B2-RAA-SPRINT0-RESOLVER
timestamp: 2026-08-15

## Acção proposta

Aplicar `supabase/migrations/20260815140000_academic_regime_resolver.sql` no Supabase para ativar o resolvedor académico único do RAA.

## Escopo

- adicionar os campos normalizados `nivel_ensino`, `ano_numero` e `modulo_numero` em `turmas`;
- executar backfill conservador dos dados existentes;
- criar `resolve_regime_academico_atributos(...)`;
- criar `resolve_regime_academico(turma_id)`;
- manter `is_turma_classe_exame` apenas como adaptador de compatibilidade;
- suportar 6.ª, 9.ª, 12.ª, Módulo 3 EJA e 2.º ano EJA;
- centralizar escala, fórmula MFD e exames aplicáveis.

## Evidência atual

A consulta de leitura à base encontrou apenas:

```text
public.is_turma_classe_exame(uuid) -> boolean
```

Os resolvedores `resolve_regime_academico` e `resolve_regime_academico_atributos` não foram encontrados.

## Risco

Médio: altera schema e executa backfill em `turmas`. A migration é aditiva, mas o backfill deve ser validado com dados representativos antes de promover a base.

## Verificação pós-apply

1. Confirmar as duas funções novas no catálogo PostgreSQL.
2. Confirmar as três colunas normalizadas em `turmas`.
3. Executar casos fictícios para 12.ª classe, Módulo 3 e 2.º ano EJA.
4. Confirmar que o wrapper TS recebe o contrato esperado.

## Como aprovar

Commit com mensagem: `APPROVE: 7C91E4B2-RAA-SPRINT0-RESOLVER`

## Como rejeitar

Commit com mensagem: `REJECT: 7C91E4B2-RAA-SPRINT0-RESOLVER [motivo]`

## Aprovação recebida

`APPROVE: 7C91E4B2-RAA-SPRINT0-RESOLVER`

## Estado

APPROVED. A migration foi aplicada no Supabase após correção do backfill e o contrato foi validado com casos de 12.ª classe, Módulo 3 e 2.º ano EJA.
