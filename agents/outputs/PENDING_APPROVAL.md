# Aprovação aplicada — Agent 3
run_id:    a1338163-1df9-4a14-9f79-ff677e5f3e84
timestamp: 2026-10-28T22:43:15.571266+00:00

## Estado atual
Aprovado explicitamente pelo proprietário nesta conversa. Aceite registado no commit 42c9855c8 com mensagem APPROVE: a1338163-1df9-4a14-9f79-ff677e5f3e84.
Aplicado no Supabase em 2026-10-28, migration 20261028224738_appypay_atomic_confirmation.sql.
Código da função conferido por hash MD5 do corpo: e65f5a8266e38cebf57f0f9baa2d07e9, idêntico ao diff aprovado.
SECURITY INVOKER confirmado; anon sem EXECUTE; authenticated e service_role com EXECUTE; search_path fixo.
Probe com intent inexistente confirmou APPYPAY_INTENT_NOT_FOUND sem alterar pagamentos.
Advisors de segurança consultados; nenhum aviso específico AppyPay retornado. Não é declaração de ausência de avisos globais.
Provedor e emissão continuam desativados. Não houve merge, deploy ou cobrança.

O conteúdo abaixo é o snapshot da proposta e das provas disponíveis antes da aprovação; não constitui nova aprovação pendente.

## Acção proposta
Adicionar public.appypay_confirm_payment(uuid), SECURITY INVOKER, para verificar autorização/vínculo da referência e revalidar o saldo sob locks de intent e mensalidade antes de chamar finance_confirm_payment. Não altera RLS, nomes/tipos de colunas, dados de escolas ou a função financeira existente.

## Diff
```diff
--- /dev/null
+++ b/supabase/migrations/<gerar-com-supabase-migration-new>_appypay_atomic_confirmation.sql
@@ -0,0 +1,47 @@
+BEGIN;
+CREATE OR REPLACE FUNCTION public.appypay_confirm_payment(p_intent_id uuid)
+RETURNS public.finance_payment_intents
+LANGUAGE plpgsql
+SECURITY INVOKER
+SET search_path = public, pg_temp
+AS $function$
+DECLARE
+  v_intent public.finance_payment_intents;
+  v_mensalidade public.mensalidades;
+BEGIN
+  SELECT * INTO v_intent FROM public.finance_payment_intents
+  WHERE id = p_intent_id FOR UPDATE;
+  IF NOT FOUND THEN RAISE EXCEPTION 'APPYPAY_INTENT_NOT_FOUND'; END IF;
+  IF coalesce(auth.role(), '') <> 'service_role'
+    AND NOT coalesce(public.can_manage_school(v_intent.escola_id), false) THEN
+    RAISE EXCEPTION 'APPYPAY_FORBIDDEN';
+  END IF;
+  IF v_intent.currency <> 'AOA' OR v_intent.method <> 'referencia'
+    OR v_intent.amount <= 0
+    OR v_intent.dedupe_key IS DISTINCT FROM ('appypay:' || v_intent.external_ref) THEN
+    RAISE EXCEPTION 'APPYPAY_INTENT_INVALID';
+  END IF;
+  IF NOT EXISTS (
+    SELECT 1 FROM public.payment_references r
+    JOIN public.school_payment_providers p ON p.id = r.provider_id AND p.school_id = r.school_id
+    WHERE r.school_id = v_intent.escola_id AND r.obligation_id = v_intent.mensalidade_id
+      AND r.provider_reference_id = v_intent.external_ref
+      AND r.amount = v_intent.amount AND r.currency = 'AOA'
+      AND p.provider_type = 'appypay' AND p.status = 'active'
+  ) THEN RAISE EXCEPTION 'APPYPAY_REFERENCE_INVALID'; END IF;
+  IF v_intent.status = 'confirmed' THEN RETURN v_intent; END IF;
+  IF v_intent.status <> 'pending' THEN RAISE EXCEPTION 'APPYPAY_INTENT_INVALID'; END IF;
+  SELECT * INTO v_mensalidade FROM public.mensalidades
+  WHERE id = v_intent.mensalidade_id AND escola_id = v_intent.escola_id FOR UPDATE;
+  IF NOT FOUND THEN RAISE EXCEPTION 'APPYPAY_BALANCE_CHANGED'; END IF;
+  IF v_mensalidade.status IN ('pago', 'isento', 'cancelado')
+    OR round(coalesce(v_mensalidade.valor_previsto, v_mensalidade.valor, 0)
+      - coalesce(v_mensalidade.valor_pago_total, 0), 2) <> round(v_intent.amount, 2) THEN
+    RAISE EXCEPTION 'APPYPAY_BALANCE_CHANGED';
+  END IF;
+  RETURN public.finance_confirm_payment(p_intent_id);
+END;
+$function$;
+REVOKE ALL ON FUNCTION public.appypay_confirm_payment(uuid) FROM PUBLIC, anon;
+GRANT EXECUTE ON FUNCTION public.appypay_confirm_payment(uuid) TO authenticated, service_role;
+COMMIT;
```

## Risco
A função participa na confirmação de pagamentos. Um erro pode impedir baixas; por isso o provedor e APPYPAY_ENABLED continuam desativados. A proposta passou em PostgreSQL 14 local com fixtures, incluindo concorrência real, mas ainda precisa de validação no schema PostgreSQL 17 completo. Preserva intents/eventos existentes e não altera a RPC existente.

## Como aprovar
Commit com mensagem: `APPROVE: a1338163-1df9-4a14-9f79-ff677e5f3e84`

## Como rejeitar
Commit com mensagem: `REJECT: a1338163-1df9-4a14-9f79-ff677e5f3e84 [motivo]`

## Prova disponível
- 14 testes de código/HTTP aprovados; 3 cenários locais de SQL/concorrência aprovados.
- Typecheck strict core/service aprovado; build global limitado por dependências ausentes.
- Credenciais guardadas como Secret na Vercel com autorização explícita; produção somente, emissão desativada.
- Não houve cobrança, merge ou publicação. Não houve aplicação desta função no Supabase.
- Proposta reutilizável: docs/financeiro/appypay-confirm-payment.proposed.sql.
- A aprovação inicial 8c426762-0ebb-43d8-b5a0-7856de85c343 cobria somente a constraint de provider_type, já aplicada. Este diff é uma nova aprovação de SQL financeiro.
