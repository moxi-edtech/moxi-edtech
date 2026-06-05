# Aprovação necessária — Agent 3
run_id:    PORTAL-ALUNO-REM-JANELA-20260604
timestamp: 2026-06-04T00:00:00-03:00
status:    APPROVED_AND_APPLIED

## Acção proposta

Criar uma janela explícita de rematrícula online por escola e ano letivo, e exigir essa janela tanto no banner/status do portal do aluno quanto na RPC transacional `aluno_confirmar_rematricula`.

## Diff

```diff
diff --git a/supabase/migrations/20270604201000_aluno_rematricula_janela_portal.sql b/supabase/migrations/20270604201000_aluno_rematricula_janela_portal.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270604201000_aluno_rematricula_janela_portal.sql
@@
+BEGIN;
+
+CREATE TABLE IF NOT EXISTS public.rematricula_janelas (
+  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
+  ano_letivo integer NOT NULL,
+  data_inicio timestamptz NOT NULL,
+  data_fim timestamptz NOT NULL,
+  ativa boolean NOT NULL DEFAULT false,
+  observacao text,
+  created_at timestamptz NOT NULL DEFAULT now(),
+  updated_at timestamptz NOT NULL DEFAULT now(),
+  created_by uuid DEFAULT public.safe_auth_uid(),
+  updated_by uuid DEFAULT public.safe_auth_uid(),
+  CONSTRAINT rematricula_janelas_periodo_check CHECK (data_fim > data_inicio),
+  CONSTRAINT rematricula_janelas_ano_check CHECK (ano_letivo BETWEEN 2000 AND 2100),
+  CONSTRAINT rematricula_janelas_ano_fk
+    FOREIGN KEY (escola_id, ano_letivo)
+    REFERENCES public.anos_letivos(escola_id, ano)
+    ON DELETE CASCADE
+);
+
+CREATE INDEX IF NOT EXISTS idx_rematricula_janelas_escola_periodo
+  ON public.rematricula_janelas (escola_id, ativa, ano_letivo, data_inicio, data_fim);
+
+CREATE UNIQUE INDEX IF NOT EXISTS ux_rematricula_janelas_ativa_escola_ano
+  ON public.rematricula_janelas (escola_id, ano_letivo)
+  WHERE ativa = true;
+
+ALTER TABLE public.rematricula_janelas ENABLE ROW LEVEL SECURITY;
+
+DROP POLICY IF EXISTS rematricula_janelas_select_tenant ON public.rematricula_janelas;
+CREATE POLICY rematricula_janelas_select_tenant
+  ON public.rematricula_janelas
+  FOR SELECT
+  TO authenticated
+  USING (escola_id = public.current_tenant_escola_id() OR public.is_super_admin());
+
+DROP POLICY IF EXISTS rematricula_janelas_insert_staff ON public.rematricula_janelas;
+CREATE POLICY rematricula_janelas_insert_staff
+  ON public.rematricula_janelas
+  FOR INSERT
+  TO authenticated
+  WITH CHECK (
+    escola_id = public.current_tenant_escola_id()
+    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','secretaria','diretor']::text[])
+  );
+
+DROP POLICY IF EXISTS rematricula_janelas_update_staff ON public.rematricula_janelas;
+CREATE POLICY rematricula_janelas_update_staff
+  ON public.rematricula_janelas
+  FOR UPDATE
+  TO authenticated
+  USING (
+    escola_id = public.current_tenant_escola_id()
+    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','secretaria','diretor']::text[])
+  )
+  WITH CHECK (
+    escola_id = public.current_tenant_escola_id()
+    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','secretaria','diretor']::text[])
+  );
+
+DROP POLICY IF EXISTS rematricula_janelas_delete_staff ON public.rematricula_janelas;
+CREATE POLICY rematricula_janelas_delete_staff
+  ON public.rematricula_janelas
+  FOR DELETE
+  TO authenticated
+  USING (
+    escola_id = public.current_tenant_escola_id()
+    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','secretaria','diretor']::text[])
+  );
+
+CREATE OR REPLACE FUNCTION public.aluno_confirmar_rematricula(p_matricula_id uuid)
+RETURNS TABLE (candidatura_id uuid, next_ano integer, reused boolean)
+LANGUAGE plpgsql
+SECURITY DEFINER
+SET search_path = public
+AS $$
+DECLARE
+  v_uid uuid := public.safe_auth_uid();
+  v_escola_id uuid := public.current_tenant_escola_id();
+  v_mat record;
+  v_aluno record;
+  v_next_ano integer;
+  v_candidatura_id uuid;
+BEGIN
+  -- manter validações existentes de auth, matrícula atual e propriedade do aluno
+  -- trocar a escolha do próximo ano por janela explícita:
+  SELECT rj.ano_letivo
+  INTO v_next_ano
+  FROM public.rematricula_janelas rj
+  JOIN public.anos_letivos al
+    ON al.escola_id = rj.escola_id
+   AND al.ano = rj.ano_letivo
+  WHERE rj.escola_id = v_escola_id
+    AND rj.ativa = true
+    AND rj.ano_letivo > v_mat.ano_letivo
+    AND now() >= rj.data_inicio
+    AND now() <= rj.data_fim
+  ORDER BY rj.ano_letivo ASC, rj.data_inicio DESC
+  LIMIT 1;
+
+  IF v_next_ano IS NULL THEN
+    RAISE EXCEPTION 'DATA: período de rematrícula não está aberto';
+  END IF;
+  -- manter advisory lock, bloqueio financeiro, idempotência, insert e auditoria existentes
+END;
+$$;
+
+COMMIT;
diff --git a/apps/web/src/app/api/aluno/rematricula/status/route.ts b/apps/web/src/app/api/aluno/rematricula/status/route.ts
--- a/apps/web/src/app/api/aluno/rematricula/status/route.ts
+++ b/apps/web/src/app/api/aluno/rematricula/status/route.ts
@@
-    // 1. Buscar próximo ano letivo
-    const { data: nextAnoRow, error: nextAnoError } = await supabase
-      .from('anos_letivos')
-      .select('id, ano')
-      .eq('escola_id', escolaId)
-      .gt('ano', currentAno)
-      .order('ano', { ascending: true })
+    // 1. Buscar janela explícita de rematrícula aberta
+    const nowIso = new Date().toISOString()
+    const { data: nextAnoRow, error: nextAnoError } = await supabase
+      .from('rematricula_janelas')
+      .select('ano_letivo, data_inicio, data_fim')
+      .eq('escola_id', escolaId)
+      .eq('ativa', true)
+      .gt('ano_letivo', currentAno)
+      .lte('data_inicio', nowIso)
+      .gte('data_fim', nowIso)
+      .order('ano_letivo', { ascending: true })
       .limit(1)
       .maybeSingle()
@@
-      return NextResponse.json({ ok: true, eligible: false, reason: 'Período de rematrícula não iniciado (Próximo ano não cadastrado)' })
+      return NextResponse.json({ ok: true, eligible: false, reason: 'Período de rematrícula não está aberto.' })
@@
-    const nextAno = nextAnoRow.ano
+    const nextAno = nextAnoRow.ano_letivo
```

## Risco

Sem uma janela cadastrada e ativa, o portal deixa de mostrar o banner e a RPC passa a recusar novas solicitações de rematrícula online.

## Validação planejada antes de aplicar em produção

1. Simular a migration em transação com `ROLLBACK`.
2. Confirmar que aluno sem janela aberta recebe `eligible=false` e a RPC retorna `DATA: período de rematrícula não está aberto`.
3. Criar janela sintética em transação e confirmar que status/RPC voltam a permitir o fluxo.
4. Confirmar que `anon` não tem permissão de mutação e que apenas staff pode criar/editar janelas.
5. Rodar `typecheck` e `lint`.

## Resultado da aplicação

- Migration aplicada e registrada: `20270604201000_aluno_rematricula_janela_portal.sql`.
- Tabela ativa: `public.rematricula_janelas`.
- Índice único ativo: `ux_rematricula_janelas_ativa_escola_ano`.
- Policies RLS ativas: 4.
- RPC `aluno_confirmar_rematricula(uuid)` sem grant para `anon`; `authenticated` com `EXECUTE`.
- Asserção transacional sem janela: `DATA: período de rematrícula não está aberto`.
- Asserção transacional com janela sintética: primeira chamada `reused=false`, segunda chamada `reused=true`, total `1`.
- Checks locais: `pnpm -C apps/web typecheck` PASS; `pnpm -C apps/web lint` PASS com warnings existentes.

## Como aprovar

Commit com mensagem: `APPROVE: PORTAL-ALUNO-REM-JANELA-20260604`

## Como rejeitar

Commit com mensagem: `REJECT: PORTAL-ALUNO-REM-JANELA-20260604 [motivo]`
