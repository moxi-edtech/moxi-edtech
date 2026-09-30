# Proposed apply diff — 51fc910e-e33c-41b1-8eb5-e61689eb9eac

status: PENDING_APPROVAL  
target_branch: `integration/main-alignment-20260929`  
base_head_reviewed: `51fc910ee33c41b15eb5e61689eb9eacea525357`

## 1. New migration

Path generated with `supabase migration new fix_secretaria_batch_payment_atomicity`:

`supabase/migrations/20260930104911_fix_secretaria_batch_payment_atomicity.sql`

```sql
CREATE OR REPLACE FUNCTION public.financeiro_registrar_pagamentos_secretaria_batch(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_itens jsonb,
  p_metodo public.pagamento_metodo,
  p_idempotency_key text,
  p_reference text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL,
  p_gateway_ref text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_count integer;
  v_existing_count integer;
  v_existing jsonb;
  v_item jsonb;
  v_index integer;
  v_type text;
  v_item_id uuid;
  v_amount numeric;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_matricula public.matriculas%ROWTYPE;
  v_ano public.anos_letivos%ROWTYPE;
  v_window record;
  v_billing_year integer;
  v_billing_turma_id uuid;
  v_competencia date;
  v_inicio_mes date;
  v_fim_mes date;
  v_child_key text;
  v_child_meta jsonb;
  v_payment public.pagamentos%ROWTYPE;
  v_payments jsonb := '[]'::jsonb;
  v_last_payment jsonb := NULL;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated';
  END IF;

  IF NOT public.is_super_admin()
     AND NOT public.user_has_role_in_school(
       p_escola_id,
       ARRAY['secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin_escola','admin','staff_admin']
     ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  IF COALESCE(btrim(p_idempotency_key), '') = '' THEN
    RAISE EXCEPTION 'DATA: idempotency_key_required';
  END IF;

  IF jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'DATA: itens must be an array';
  END IF;

  v_count := jsonb_array_length(p_itens);
  IF v_count < 1 OR v_count > 50 THEN
    RAISE EXCEPTION 'DATA: itens must contain between 1 and 50 entries';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_escola_id::text || ':' || p_idempotency_key, 0)
  );

  SELECT count(*),
         COALESCE(
           jsonb_agg(to_jsonb(p) ORDER BY (p.meta->>'batch_index')::integer),
           '[]'::jsonb
         )
    INTO v_existing_count, v_existing
  FROM public.pagamentos p
  WHERE p.escola_id = p_escola_id
    AND p.meta->>'batch_idempotency_key' = p_idempotency_key;

  IF v_existing_count = v_count THEN
    SELECT value
      INTO v_last_payment
    FROM jsonb_array_elements(v_existing)
    WITH ORDINALITY AS x(value, ordinality)
    ORDER BY ordinality DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'data', v_last_payment,
      'pagamentos', v_existing
    );
  ELSIF v_existing_count > 0 THEN
    RAISE EXCEPTION 'STATE: checkout has a partial previous settlement; manual reconciliation required';
  END IF;

  FOR v_item, v_index IN
    SELECT value, ordinality::integer
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'DATA: invalid item at position %', v_index;
    END IF;

    v_type := v_item->>'tipo';
    IF v_type NOT IN ('mensalidade', 'servico') THEN
      RAISE EXCEPTION 'DATA: invalid item type at position %', v_index;
    END IF;

    BEGIN
      v_item_id := (v_item->>'id')::uuid;
      v_amount := (v_item->>'preco')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'DATA: invalid item id/value at position %', v_index;
    END;

    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'DATA: item value must be positive at position %', v_index;
    END IF;

    IF v_type = 'mensalidade' THEN
      SELECT *
        INTO v_mensalidade
      FROM public.mensalidades
      WHERE id = v_item_id
        AND escola_id = p_escola_id
      LIMIT 1;

      IF NOT FOUND OR v_mensalidade.matricula_id IS NULL THEN
        RAISE EXCEPTION 'DATA: mensalidade not found at position %', v_index;
      END IF;

      IF v_mensalidade.aluno_id IS DISTINCT FROM p_aluno_id THEN
        RAISE EXCEPTION 'AUTH: mensalidade outside selected student context';
      END IF;

      SELECT *
        INTO v_matricula
      FROM public.matriculas
      WHERE id = v_mensalidade.matricula_id
        AND escola_id = p_escola_id
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'DATA: matricula for mensalidade not found';
      END IF;

      v_billing_year := COALESCE(
        NULLIF(v_mensalidade.ano_letivo, 0),
        NULLIF(v_mensalidade.ano_referencia, 0),
        NULLIF(v_matricula.ano_letivo, 0)
      );

      IF v_billing_year IS NULL THEN
        RAISE EXCEPTION 'DATA: academic year for mensalidade not found';
      END IF;

      SELECT *
        INTO v_ano
      FROM public.anos_letivos
      WHERE escola_id = p_escola_id
        AND ano = v_billing_year
      ORDER BY ativo DESC NULLS LAST, data_inicio DESC
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'DATA: academic year for mensalidade not found';
      END IF;

      v_billing_turma_id := COALESCE(v_mensalidade.turma_id, v_matricula.turma_id);

      IF v_mensalidade.mes_referencia IS NOT NULL
         AND v_mensalidade.ano_referencia IS NOT NULL
         AND v_billing_turma_id IS NOT NULL THEN
        SELECT *
          INTO v_window
        FROM public.resolve_turma_janela_cobranca(v_billing_turma_id, v_ano.id)
        LIMIT 1;

        IF NOT FOUND OR v_window.data_inicio IS NULL OR v_window.data_fim IS NULL THEN
          RAISE EXCEPTION 'STATE: billing window could not be resolved';
        END IF;

        v_competencia := make_date(
          v_mensalidade.ano_referencia,
          v_mensalidade.mes_referencia,
          1
        );
        v_inicio_mes := date_trunc('month', v_window.data_inicio)::date;
        v_fim_mes := date_trunc('month', v_window.data_fim)::date;

        IF v_competencia < v_inicio_mes
           OR v_competencia > v_fim_mes
           OR (COALESCE(v_window.is_classe_exame, false) IS FALSE AND v_competencia = v_fim_mes) THEN
          RAISE EXCEPTION 'Esta mensalidade está fora da janela de cobrança da turma e não pode ser liquidada.';
        END IF;
      END IF;

      IF COALESCE(p_meta->>'origem', '') = 'pos_virada' THEN
        IF NULLIF(p_meta->>'matricula_origem_id', '') IS NULL
           OR (p_meta->>'matricula_origem_id')::uuid IS DISTINCT FROM v_mensalidade.matricula_id THEN
          RAISE EXCEPTION 'STATE: pos_virada_context_mismatch';
        END IF;
      ELSIF COALESCE(v_matricula.ano_letivo, 0) > 0
            AND v_matricula.ano_letivo IS DISTINCT FROM v_billing_year THEN
        RAISE EXCEPTION 'STATE: cross_year_entity_mismatch';
      END IF;
    END IF;

    v_child_key := p_idempotency_key || ':' || (v_index - 1)::text;
    v_child_meta := COALESCE(p_meta, '{}'::jsonb)
      || jsonb_build_object(
        'idempotency_key', v_child_key,
        'batch_idempotency_key', p_idempotency_key,
        'batch_index', v_index - 1,
        'descricao_item', COALESCE(
          NULLIF(btrim(v_item->>'nome'), ''),
          CASE WHEN v_type = 'mensalidade' THEN 'Mensalidade' ELSE 'Serviço escolar' END
        ),
        'matricula_id', COALESCE(
          NULLIF(p_meta->>'matricula_id', ''),
          NULLIF(v_item->>'origem_matricula_id', '')
        ),
        'itens', p_itens,
        'emitir_recibo', v_index = v_count
      );

    SELECT *
      INTO v_payment
    FROM public.financeiro_registrar_pagamento_secretaria(
      p_escola_id,
      p_aluno_id,
      CASE WHEN v_type = 'mensalidade' THEN v_item_id ELSE NULL END,
      v_amount,
      p_metodo,
      p_reference,
      p_evidence_url,
      p_gateway_ref,
      v_child_meta
    );

    v_last_payment := to_jsonb(v_payment);
    v_payments := v_payments || jsonb_build_array(v_last_payment);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'data', v_last_payment,
    'pagamentos', v_payments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_registrar_pagamentos_secretaria_batch(
  uuid, uuid, jsonb, public.pagamento_metodo, text, text, text, text, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.financeiro_registrar_pagamentos_secretaria_batch(
  uuid, uuid, jsonb, public.pagamento_metodo, text, text, text, text, jsonb
) TO authenticated, service_role;

```

## 2. `apps/web/src/app/api/secretaria/pagamentos/processar/route.ts`

Exact behavioral change proposed:

```diff
-import { POST as processarPagamentoBalcao } from "../../balcao/pagamentos/route";
+import { POST as processarPagamentoBalcao } from "../../balcao/pagamentos/route";
+import { requireRoleInSchool } from "@/lib/authz";
+import { recordAuditServer } from "@/lib/audit";
+import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";
+import { supabaseServerTyped } from "@/lib/supabaseServer";
+import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
+import type { Database, Json } from "~types/supabase";

-  metodo_pagamento: z.string().min(1),
+  metodo_pagamento: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"]),

+function asRecord(value: unknown): Record<string, unknown> {
+  return value && typeof value === "object" && !Array.isArray(value)
+    ? value as Record<string, unknown>
+    : {};
+}
+
+function getStringField(record: Record<string, unknown>, key: string): string | null {
+  const value = record[key];
+  return typeof value === "string" && value.trim() ? value : null;
+}
+
+async function enrichBatchReceiptSnapshot(...) {
+  // Same snapshot merge used by the canonical balcão route:
+  // preserves tipo_comprovativo, itens_pagamento, referencia, valor_pago,
+  // metodo and data_pagamento on documentos_emitidos.dados_snapshot.
+}

 export async function POST(request: Request) {
   ...
   const itensPagamento = parsed.data.itens;
   ...
   const requestId = request.headers.get("Idempotency-Key") ?? crypto.randomUUID();
+
+  // Keep the existing canonical path for single-item checkouts.
+  if (itensPagamento.length === 1) {
+    const item = itensPagamento[0];
+    const delegatedHeaders = new Headers(request.headers);
+    delegatedHeaders.set("Idempotency-Key", `${requestId}:0`);
+    return processarPagamentoBalcao(new Request(request.url, {
+      method: "POST",
+      headers: delegatedHeaders,
+      body: JSON.stringify({
+        aluno_id: parsed.data.aluno_id,
+        mensalidade_id: item.tipo === "mensalidade" ? item.id : undefined,
+        valor: item.preco,
+        metodo: parsed.data.metodo_pagamento === "kiwk" ? "kwik" : parsed.data.metodo_pagamento,
+        reference: emptyStringToNull(detalhes.referencia),
+        evidence_url: emptyStringToNull(detalhes.evidencia_url),
+        gateway_ref: emptyStringToNull(detalhes.gateway_ref),
+        ano_letivo_id: parsed.data.ano_letivo_id ?? undefined,
+        meta: {
+          origem: parsed.data.origem ?? "secretaria_pagamentos_processar_compat",
+          pedido_id: parsed.data.pedido_id ?? null,
+          matricula_id: parsed.data.matricula_id
+            ?? (item.tipo === "mensalidade" ? item.origem_matricula_id : null)
+            ?? null,
+          descricao_item: item.nome ?? (item.tipo === "mensalidade" ? "Mensalidade" : "Serviço escolar"),
+          itens: itensPagamento,
+          emitir_recibo: true,
+        },
+      }),
+    }));
+  }
+
+  const supabase = await supabaseServerTyped<Database>();
+  const { data: { user } } = await supabase.auth.getUser();
+  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
+
+  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
+  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
+
+  const authz = await requireRoleInSchool({
+    supabase,
+    escolaId,
+    roles: ["secretaria","secretaria_financeiro","admin_financeiro","admin","admin_escola","staff_admin"],
+  });
+  if (authz.error) return authz.error;
+
+  let academicContext;
+  try {
+    academicContext = await resolveAcademicYearContext(supabase as any, {
+      userId: user.id,
+      requestedAcademicYearId: parsed.data.ano_letivo_id ?? undefined,
+      operation: "WRITE",
+    });
+  } catch (err) {
+    if (err instanceof AcademicYearContextError) {
+      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
+    }
+    throw err;
+  }
+
+  const metodo = parsed.data.metodo_pagamento === "kiwk" ? "kwik" : parsed.data.metodo_pagamento;
+  const baseMeta = {
+    origem: parsed.data.origem ?? "secretaria_pagamentos_processar_compat",
+    pedido_id: parsed.data.pedido_id ?? null,
+    matricula_id: parsed.data.matricula_id ?? null,
+    matricula_origem_id: parsed.data.matricula_id ?? null,
+    ano_letivo_id: academicContext.anoLetivoId,
+  };
+
+  const { data: batchData, error: batchError } = await (supabase as any).rpc(
+    "financeiro_registrar_pagamentos_secretaria_batch",
+    {
+      p_escola_id: escolaId,
+      p_aluno_id: parsed.data.aluno_id,
+      p_itens: itensPagamento,
+      p_metodo: metodo,
+      p_idempotency_key: requestId,
+      p_reference: emptyStringToNull(detalhes.referencia),
+      p_evidence_url: emptyStringToNull(detalhes.evidencia_url),
+      p_gateway_ref: emptyStringToNull(detalhes.gateway_ref),
+      p_meta: baseMeta,
+    },
+  );
+
+  if (batchError) {
+    return NextResponse.json({ ok: false, error: batchError.message }, { status: 400 });
+  }
+
+  const batch = asRecord(batchData);
+  const pagamentos = Array.isArray(batch.pagamentos) ? batch.pagamentos : [];
+  const ultimoPagamento = asRecord(batch.data);
+  const idempotent = batch.idempotent === true;
+
+  // Receipt remains outside the financial transaction, matching current behavior.
+  // It is emitted only for a fresh batch, never on an idempotent retry.
+  let recibo: Record<string, unknown> | null = null;
+  if (!idempotent) {
+    const lastItem = itensPagamento[itensPagamento.length - 1];
+    if (lastItem.tipo === "mensalidade") {
+      const { data } = await supabase.rpc("emitir_recibo", { p_mensalidade_id: lastItem.id });
+      recibo = asRecord(data);
+    } else if (getStringField(ultimoPagamento, "status") === "settled") {
+      const pagamentoId = getStringField(ultimoPagamento, "id");
+      if (pagamentoId) {
+        const { data } = await (supabase as any).rpc("emitir_recibo_servicos", { p_pagamento_id: pagamentoId });
+        recibo = asRecord(data);
+      }
+    }
+    // Normalize receipt and enrich snapshot using the same fields as the canonical route.
+  }
+
+  if (!idempotent) {
+    pagamentos.forEach((row, index) => {
+      const payment = asRecord(row);
+      recordAuditServer({
+        escolaId,
+        portal: "secretaria",
+        acao: "PAGAMENTO_REGISTRADO",
+        entity: "pagamento",
+        entityId: getStringField(payment, "id"),
+        details: {
+          valor: itensPagamento[index]?.preco ?? null,
+          metodo,
+          fiscal_ok: false,
+          ano_letivo_id: academicContext.anoLetivoId,
+          batch_idempotency_key: requestId,
+        },
+      }).catch(() => null);
+    });
+  }
+
+  return NextResponse.json({
+    ok: true,
+    data: ultimoPagamento,
+    recibo,
+    fiscal: { ok: false, error: "Emissão fiscal desativada" },
+    pagamentos,
+    idempotent,
+  });
-
-  // Remove the current loop that calls processarPagamentoBalcao once per item.
 }
```

## 3. `apps/web/src/components/secretaria/BalcaoAtendimento.tsx`

```diff
 function useCheckout(...) {
+  const checkoutRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);
   ...
   const checkout = useCallback(async (): Promise<boolean> => {
     ...
+    const checkoutPayload = {
+      escola_id: escolaId,
+      aluno_id: aluno.id,
+      matricula_id: aluno.matricula_id,
+      ano_letivo_id: academicYearId,
+      metodo_pagamento: carrinho.metodo,
+      detalhes: carrinho.detalhes,
+      itens: carrinho.itens,
+    };
+    const fingerprint = JSON.stringify(checkoutPayload);
+    if (!checkoutRequestRef.current || checkoutRequestRef.current.fingerprint !== fingerprint) {
+      checkoutRequestRef.current = { fingerprint, key: crypto.randomUUID() };
+    }
+
     const response = await fetch("/api/secretaria/pagamentos/processar", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
-        "Idempotency-Key": crypto.randomUUID(),
+        "Idempotency-Key": checkoutRequestRef.current.key,
       },
-      body: JSON.stringify({ ... }),
+      body: JSON.stringify(checkoutPayload),
     });
     ...
     if (success) {
+      checkoutRequestRef.current = null;
       carrinho.limpar();
     }
   });
 }
```

## Expected verification after approval

1. Create/apply the above migration only in a disposable/local Supabase environment first.
2. Regression test: item 1 valid + item 2 invalid => **zero new payment rows**.
3. Regression test: two valid items => both committed in one RPC.
4. Retry same batch key => no duplicate rows.
5. Concurrent same batch key => advisory lock + idempotency prevent duplicates.
6. Single-item checkout keeps the existing canonical path.
7. KF2 + focused TypeScript/lint tests.
8. Clean Next/Vercel preview build and smoke test.
9. No remote production migration, merge, or promotion until all evidence is green.
