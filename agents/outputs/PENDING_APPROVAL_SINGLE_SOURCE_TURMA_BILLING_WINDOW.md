# Aprovação necessária — Single Source of Truth da janela de cobrança

run_id:  5D4A7C21-SINGLE-SOURCE-TURMA-BILLING
timestamp: 2026-08-15

## Acção proposta

Adicionar a RPC `public.resolve_turma_janela_cobranca(uuid, uuid)` para resolver, num único ponto do banco, a data inicial, a data final e o tipo de turma aplicáveis à cobrança.

Depois da aprovação, as rotas de pagamento, geração e rematrícula serão migradas para consultar esta RPC. A tabela `turma_janelas_cobranca` continuará sendo a fonte de configuração persistida.

## Diff

```sql
CREATE OR REPLACE FUNCTION public.resolve_turma_janela_cobranca(
  p_turma_id uuid,
  p_ano_letivo_id uuid
)
RETURNS TABLE (data_inicio date, data_fim date, is_classe_exame boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(j.data_inicio, a.data_inicio),
    COALESCE(j.data_fim, a.data_fim),
    public.is_turma_classe_exame(p_turma_id)
  FROM public.anos_letivos a
  LEFT JOIN public.turma_janelas_cobranca j
    ON j.turma_id = p_turma_id
   AND j.ano_letivo_id = a.id
  WHERE a.id = p_ano_letivo_id;
$$;
```

## Risco

Baixo risco de dados: a alteração é aditiva e não modifica tabelas nem registros. Existe risco de contrato se algum consumidor já utilizar o mesmo nome de função, por isso a função deve ser validada antes de aplicar.

## Como aprovar

Commit com mensagem: `APPROVE: 5D4A7C21-SINGLE-SOURCE-TURMA-BILLING`

## Como rejeitar

Commit com mensagem: `REJECT: 5D4A7C21-SINGLE-SOURCE-TURMA-BILLING [motivo]`

## Aprovação recebida

`APPROVE: 5D4A7C21-SINGLE-SOURCE-TURMA-BILLING`

## Estado

APPROVED. A RPC foi aplicada no Supabase e validada com a assinatura esperada. Os consumidores de aplicação foram migrados.
