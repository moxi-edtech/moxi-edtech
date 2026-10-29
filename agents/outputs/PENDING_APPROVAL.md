# Aprovação aplicada — Agent 3
run_id: cf8dc48d-6b39-47d3-af87-410afcf95ddb
timestamp: 2026-10-29T12:02:40.057637+00:00

## Acção proposta
Instalar o domínio adicional de referências AppyPay para serviços/emolumentos e a função atômica de confirmação restrita a service_role. O endpoint humano usa a sessão do aluno/encarregado e um broker de máquina assinado; não recebe chave privilegiada nem permissão para confirmar pagamento diretamente.

A solicitação atual autoriza publicar e ativar o fluxo na Escola KLASSE. Falta a aprovação específica deste SQL exigida pelo contrato para a estrutura financeira/RLS; não é uma nova solicitação de autorização geral de deploy.

## Diff
```diff
--- /dev/null
+++ b/docs/financeiro/appypay-portal-services.proposed.sql
@@ -0,0 +1,103 @@
+-- Proposed additive service domain. Apply only after the recorded approval.
+BEGIN;
+CREATE TABLE public.appypay_service_references (
+  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE RESTRICT,
+  obligation_id uuid NOT NULL REFERENCES public.servico_pedidos(id) ON DELETE RESTRICT,
+  intent_id uuid NOT NULL REFERENCES public.pagamento_intents(id) ON DELETE RESTRICT,
+  provider_id uuid NOT NULL REFERENCES public.school_payment_providers(id) ON DELETE RESTRICT,
+  provider_reference_id text NOT NULL,
+  entity text NOT NULL,
+  reference text NOT NULL,
+  amount numeric(14,2) NOT NULL CHECK (amount > 0),
+  currency text NOT NULL DEFAULT 'AOA' CHECK (currency = 'AOA'),
+  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paid','expired','cancelled','failed')),
+  expires_at timestamptz NOT NULL,
+  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
+  created_at timestamptz NOT NULL DEFAULT now(),
+  updated_at timestamptz NOT NULL DEFAULT now(),
+  paid_at timestamptz,
+  UNIQUE(provider_id, provider_reference_id),
+  UNIQUE(provider_id, reference)
+);
+CREATE UNIQUE INDEX ux_appypay_service_reference_obligation
+  ON public.appypay_service_references(school_id, obligation_id) WHERE status IN ('pending','active','paid');
+CREATE INDEX ix_appypay_service_reference_status ON public.appypay_service_references(school_id,status,created_at DESC);
+ALTER TABLE public.appypay_service_references ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON public.appypay_service_references FROM PUBLIC, anon, authenticated;
+GRANT SELECT,INSERT,UPDATE ON public.appypay_service_references TO service_role;
+-- No student/staff policies: only the signed, authenticated portal broker can operate this table.
+CREATE FUNCTION public.appypay_confirm_service_payment(p_reference_id uuid, p_charge_id text)
+RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
+AS $function$
+DECLARE
+  v_ref public.appypay_service_references;
+  v_int public.pagamento_intents;
+  v_order public.servico_pedidos;
+  v_approval boolean;
+BEGIN
+  IF coalesce(auth.role(),'') <> 'service_role' AND session_user <> 'service_role' THEN
+    RAISE EXCEPTION 'APPYPAY_FORBIDDEN';
+  END IF;
+  SELECT * INTO v_ref FROM public.appypay_service_references WHERE id=p_reference_id FOR UPDATE;
+  IF NOT FOUND OR v_ref.provider_reference_id IS DISTINCT FROM p_charge_id THEN RAISE EXCEPTION 'APPYPAY_REFERENCE_INVALID'; END IF;
+  IF NOT EXISTS (SELECT 1 FROM public.school_payment_providers p WHERE p.id=v_ref.provider_id
+    AND p.school_id=v_ref.school_id AND p.provider_type='appypay' AND p.status='active') THEN
+    RAISE EXCEPTION 'APPYPAY_PROVIDER_INVALID';
+  END IF;
+  -- A verified event is persisted by the worker only after its authenticated AppyPay GET.
+  IF NOT EXISTS (SELECT 1 FROM public.payment_provider_events e WHERE e.provider_id=v_ref.provider_id
+    AND e.school_id=v_ref.school_id AND e.idempotency_key='appypay:' || p_charge_id
+    AND e.payload->>'id'=p_charge_id
+    AND (e.payload->>'amount')::numeric=v_ref.amount
+    AND e.payload->>'merchantTransactionId'=v_ref.provider_payload->>'merchant_id'
+    AND e.payload->'responseStatus'->>'source'='REF'
+    AND e.payload->'responseStatus'->>'successful'='true'
+    AND e.payload->'responseStatus'->>'status'='Success'
+    AND e.payload->'responseStatus'->>'code'='100') THEN RAISE EXCEPTION 'APPYPAY_EVENT_INVALID'; END IF;
+  SELECT * INTO v_int FROM public.pagamento_intents WHERE id=v_ref.intent_id AND escola_id=v_ref.school_id FOR UPDATE;
+  IF NOT FOUND THEN RAISE EXCEPTION 'APPYPAY_INTENT_INVALID'; END IF;
+  SELECT * INTO v_order FROM public.servico_pedidos WHERE id=v_ref.obligation_id
+    AND escola_id=v_ref.school_id AND aluno_id=v_int.aluno_id FOR UPDATE;
+  IF NOT FOUND OR v_int.servico_pedido_id IS DISTINCT FROM v_order.id THEN RAISE EXCEPTION 'APPYPAY_ORDER_INVALID'; END IF;
+  IF NOT (v_int.status='settled' AND v_int.meta->>'appypay_charge_id'=p_charge_id) THEN
+    IF v_ref.status NOT IN ('pending','active') OR v_int.status NOT IN ('draft','pending')
+      OR v_order.status <> 'pending_payment' OR v_ref.currency <> 'AOA' OR v_int.currency <> 'AOA'
+      OR v_int.amount <> v_ref.amount OR v_order.valor_cobrado <> v_ref.amount THEN
+      UPDATE public.payment_provider_events SET status='manual_review',error_message='Serviço alterado ou liquidado por outro meio'
+        WHERE school_id=v_ref.school_id AND provider_id=v_ref.provider_id AND idempotency_key='appypay:' || p_charge_id;
+      RETURN jsonb_build_object('status','manual_review');
+    END IF;
+    -- Preserve existing document transition guards: draft -> pending -> settled, within this transaction.
+    IF v_int.status='draft' THEN UPDATE public.pagamento_intents SET status='pending' WHERE id=v_int.id AND escola_id=v_ref.school_id; END IF;
+    UPDATE public.pagamento_intents SET status='settled',method='mcx',reference=v_ref.reference,terminal_id=p_charge_id,
+      settled_at=now(),meta=meta || jsonb_build_object('provider','appypay','appypay_charge_id',p_charge_id,
+        'entity',v_ref.entity,'servico_codigo',v_order.servico_codigo,
+        'itens_pagamento',jsonb_build_array(jsonb_build_object('tipo','servico','nome',v_order.servico_nome,'preco',v_ref.amount)))
+      WHERE id=v_int.id AND escola_id=v_ref.school_id;
+    -- Existing materialization/audit triggers create the canonical pagamentos record once.
+    SELECT exige_aprovacao INTO v_approval FROM public.servicos_escola WHERE id=v_order.servico_escola_id AND escola_id=v_ref.school_id;
+    IF coalesce(v_approval,true) THEN
+      UPDATE public.servico_pedidos SET status='blocked',reason_code='APPYPAY_APPROVAL_REQUIRED'
+        WHERE id=v_order.id AND escola_id=v_ref.school_id;
+    ELSE
+      BEGIN
+        UPDATE public.servico_pedidos SET status='granted' WHERE id=v_order.id AND escola_id=v_ref.school_id;
+      EXCEPTION WHEN check_violation THEN
+        -- A rematriculation eligibility guard must not discard an already received payment.
+        IF SQLERRM NOT LIKE '%REMATRICULA_DEBT_REQUIRED%' THEN RAISE; END IF;
+        UPDATE public.servico_pedidos SET status='blocked',reason_code='APPYPAY_ELIGIBILITY_REVIEW'
+          WHERE id=v_order.id AND escola_id=v_ref.school_id;
+      END;
+    END IF;
+  END IF;
+  UPDATE public.appypay_service_references SET status='paid',paid_at=coalesce(paid_at,now()),updated_at=now()
+    WHERE id=v_ref.id AND school_id=v_ref.school_id AND status <> 'paid';
+  UPDATE public.payment_provider_events SET status='processed',processed_at=coalesce(processed_at,now()),error_message=null
+    WHERE school_id=v_ref.school_id AND provider_id=v_ref.provider_id AND idempotency_key='appypay:' || p_charge_id;
+  RETURN jsonb_build_object('status','reconciled');
+END;
+$function$;
+REVOKE ALL ON FUNCTION public.appypay_confirm_service_payment(uuid,text) FROM PUBLIC, anon, authenticated;
+GRANT EXECUTE ON FUNCTION public.appypay_confirm_service_payment(uuid,text) TO service_role;
+COMMIT;
```

## Risco
O SQL passa a registrar pagamentos e liberar pedidos quando a AppyPay confirma a cobrança. Um erro pode afetar a baixa ou a liberação do serviço; por isso ele é privado, valida vínculo/valor/evento, bloqueia linhas e respeita as aprovações existentes. Os testes locais não substituem o teste publicado autorizado.

Não altera tabelas, políticas ou funções financeiras existentes. Cria uma tabela nova com RLS e sem grants de acesso para alunos/anon, dois índices e uma função SECURITY INVOKER executável apenas pelo worker de serviço. Os gatilhos existentes materializam o pagamento canônico. Em produção, a instalação não liquida qualquer débito por si só.

SHA256 do SQL aprovado: 989e97331e2ddcb0aaf89723af731d5cbbf6ffcb95362ac525e39ae948bbc60a

## Como aprovar
Commit com mensagem: `APPROVE: cf8dc48d-6b39-47d3-af87-410afcf95ddb`
Conforme as aprovações anteriores nesta conversa, o proprietário pode responder com essa mensagem para registrar o commit de aprovação antes da aplicação.

## Como rejeitar
Commit com mensagem: `REJECT: cf8dc48d-6b39-47d3-af87-410afcf95ddb [motivo]`

## Após aprovação
Criar migration pelo CLI com o texto SQL exato, verificar instalação/permissões sem baixar dados reais, concluir o gate de release, publicar e registrar o webhook REF. Só habilitar o provedor/flag da Escola KLASSE após o endpoint estar alcançável. Um pagamento real de validação exige finalidade, valor e pagador expressamente definidos; não foi iniciado.

## Aplicação verificada
Aprovação explícita recebida do proprietário nesta conversa e registada no commit 5914e1c46. Migration aplicada no Supabase como 20261029121743_appypay_portal_services; ficheiro local alinhado ao histórico remoto sem mudar o SQL. SHA256 da proposta permanece 989e97331e2ddcb0aaf89723af731d5cbbf6ffcb95362ac525e39ae948bbc60a. Corpo da função MD5 64672e0d92eeed6513c2266ce996d1b0, igual ao aprovado. RLS ativo; anon/authenticated sem SELECT na tabela e sem EXECUTE na função; service_role autorizado. Índices presentes; probe de referência inexistente devolveu APPYPAY_REFERENCE_INVALID e a tabela continuou com zero registros. Nenhuma cobrança emitida.
