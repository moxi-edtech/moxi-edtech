# Aprovação necessária — Agent 3
run_id:    F65DF7BE-C5CA-41E0-9309-80811289F004
timestamp: 2026-08-23T00:00:00-03:00

## Acção proposta

Implementar comprovativo consolidado de mensalidades sem perder a granularidade
contabilística: o aluno selecciona duas ou mais mensalidades, envia um único
ficheiro e o backend cria uma alocação `pagamentos` por mensalidade, todas com o
mesmo `lote_id` em `meta`. A secretaria visualiza uma única linha agregada e a
aprovação ou rejeição processa todo o lote numa transacção atómica.

O escopo proposto contém:

- RPC `aluno_submeter_comprovativo_pagamentos(uuid[], text, jsonb, text)`;
- RPC `validar_lote_pagamentos(uuid, boolean, text)`;
- wrapper compatível para submissão de uma única mensalidade;
- `vw_pagamentos_pendentes` agregando lotes sem duplicar comprovativos;
- API do aluno aceitando `mensalidadeIds[]` e removendo o ficheiro se o registo
  transaccional falhar;
- selecção múltipla, resumo e confirmação no portal do aluno;
- aprovação/rejeição única na janela da secretaria;
- testes para autorização, cross-tenant, duplicados, valores alterados,
  idempotência, aprovação e rejeição atómicas.

## Diff

```diff
diff --git a/supabase/migrations/20270823HHMMSS_pagamentos_comprovativo_consolidado.sql b/supabase/migrations/20270823HHMMSS_pagamentos_comprovativo_consolidado.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270823HHMMSS_pagamentos_comprovativo_consolidado.sql
@@
+CREATE OR REPLACE FUNCTION public.aluno_submeter_comprovativo_pagamentos(
+  p_mensalidade_ids uuid[],
+  p_evidence_url text,
+  p_meta jsonb DEFAULT '{}'::jsonb,
+  p_mensagem text DEFAULT NULL
+) RETURNS jsonb
+LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
+-- Valida actor, aluno e tenant; bloqueia mensalidades pagas, repetidas ou com
+-- outro comprovativo pendente; bloqueia as mensalidades em ordem determinística;
+-- cria um pagamento pelo saldo actual de cada mensalidade e grava o mesmo
+-- lote_id, total, itens, storage_path e mensagem no metadata.
+
+CREATE OR REPLACE FUNCTION public.validar_lote_pagamentos(
+  p_pagamento_id uuid,
+  p_aprovado boolean,
+  p_mensagem_secretaria text DEFAULT NULL
+) RETURNS jsonb
+LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
+-- Descobre lote_id pelo pagamento seleccionado, bloqueia todos os pagamentos e
+-- mensalidades do lote, revalida saldos e liquida/rejeita o conjunto inteiro.
+-- Qualquer erro provoca rollback total. Em aprovação, emite um recibo por
+-- mensalidade liquidada e grava a mesma decisão auditável em todos os itens.
+
+DROP VIEW IF EXISTS public.vw_pagamentos_pendentes;
+CREATE VIEW public.vw_pagamentos_pendentes WITH (security_invoker = true) AS
+-- Uma linha por lote de comprovativo; mensalidades avulsas permanecem uma linha.
+-- Expõe pagamento_ids, mensalidade_ids, competências, quantidade_itens,
+-- lote_id, valor_esperado agregado e valor_enviado agregado.
+
+REVOKE ALL ON FUNCTION public.aluno_submeter_comprovativo_pagamentos(uuid[], text, jsonb, text) FROM PUBLIC;
+GRANT EXECUTE ON FUNCTION public.aluno_submeter_comprovativo_pagamentos(uuid[], text, jsonb, text) TO authenticated;
+REVOKE ALL ON FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) FROM PUBLIC;
+GRANT EXECUTE ON FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) TO authenticated;

diff --git a/apps/web/src/app/api/aluno/financeiro/comprovativo/route.ts b/apps/web/src/app/api/aluno/financeiro/comprovativo/route.ts
@@
-const mensalidadeId = formData.get("mensalidadeId")?.toString();
+const mensalidadeIds = formData.getAll("mensalidadeIds").map(String);
@@
-await rpc("aluno_submeter_comprovativo_pagamento", { p_mensalidade_id: mensalidadeId, ... });
+await rpc("aluno_submeter_comprovativo_pagamentos", { p_mensalidade_ids: mensalidadeIds, ... });
+// Se a RPC falhar depois do upload, remover o objecto órfão do Storage.

diff --git a/apps/web/src/components/aluno/tabs/TabFinanceiro.tsx b/apps/web/src/components/aluno/tabs/TabFinanceiro.tsx
@@
-<Button onClick={() => setSelected(item)}>Pagar</Button>
+<Checkbox aria-label={`Seleccionar ${item.competencia}`} />
+<Button>Regularizar {selectedIds.length} mensalidades</Button>

diff --git a/apps/web/src/components/aluno/financeiro-portal/PaymentDrawer.tsx b/apps/web/src/components/aluno/financeiro-portal/PaymentDrawer.tsx
@@
-mensalidade: Mensalidade | null;
+mensalidades: Mensalidade[];
@@
-fd.append("mensalidadeId", mensalidade.id);
+mensalidades.forEach((item) => fd.append("mensalidadeIds", item.id));
+// Mostrar competências seleccionadas, total exacto e confirmação explícita.

diff --git a/apps/web/src/hooks/usePagamentosPendentes.ts b/apps/web/src/hooks/usePagamentosPendentes.ts
@@
-supabase.rpc("validar_pagamento", { p_pagamento_id: pagamentoId, ... })
+supabase.rpc("validar_lote_pagamentos", { p_pagamento_id: pagamentoId, ... })

diff --git a/apps/web/src/components/secretaria/PagamentosPendentesWindow.tsx b/apps/web/src/components/secretaria/PagamentosPendentesWindow.tsx
@@
-<td>{row.servico_nome}</td>
+<td>{row.quantidade_itens > 1 ? `${row.quantidade_itens} mensalidades` : row.servico_nome}</td>
+<td>{row.competencias?.join(", ")}</td>
+// Uma decisão aprova ou rejeita o lote completo, com confirmação explícita.
```

## Risco

Uma falha de atomicidade pode liquidar apenas parte do comprovativo, gerar
recibos inconsistentes ou liberar a rematrícula com dívida residual incorrecta.
Por isso a mudança será implementada em RPC transaccional, sem alterar dados
existentes, e validada com rollback antes de qualquer aplicação remota.

## Como aprovar
Commit com mensagem: `APPROVE: F65DF7BE-C5CA-41E0-9309-80811289F004`

## Como rejeitar
Commit com mensagem: `REJECT: F65DF7BE-C5CA-41E0-9309-80811289F004 [motivo]`
