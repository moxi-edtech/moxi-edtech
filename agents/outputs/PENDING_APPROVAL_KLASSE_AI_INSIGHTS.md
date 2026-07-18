# Aprovação necessária — Agent 3
run_id:    E1CD76F5-8886-4B66-A37C-DBF9D5253B1A
timestamp: 2026-07-18T12:12:06Z

## Acção proposta

Criar `public.ai_insights` como memória operacional auditável do KLASSE IA, com isolamento por escola, estados de workflow, evidência estruturada, ação sugerida e políticas RLS para perfis administrativos autorizados.

## Diff

```diff
diff --git a/supabase/migrations/20270718123000_create_ai_insights.sql b/supabase/migrations/20270718123000_create_ai_insights.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270718123000_create_ai_insights.sql
@@
+BEGIN;
+
+CREATE TABLE public.ai_insights (
+  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
+  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
+  tool_id text NOT NULL,
+  fingerprint text NOT NULL,
+  title text NOT NULL,
+  severity text NOT NULL,
+  module text NOT NULL,
+  explanation text NOT NULL,
+  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
+  recommendation text NOT NULL,
+  suggested_action jsonb,
+  status text NOT NULL DEFAULT 'new',
+  first_detected_at timestamptz NOT NULL DEFAULT now(),
+  last_detected_at timestamptz NOT NULL DEFAULT now(),
+  seen_at timestamptz,
+  started_at timestamptz,
+  resolved_at timestamptz,
+  ignored_at timestamptz,
+  created_at timestamptz NOT NULL DEFAULT now(),
+  updated_at timestamptz NOT NULL DEFAULT now(),
+  CONSTRAINT ai_insights_severity_check CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
+  CONSTRAINT ai_insights_module_check CHECK (module IN ('financeiro', 'secretaria', 'academico', 'direcao')),
+  CONSTRAINT ai_insights_status_check CHECK (status IN ('new', 'seen', 'in_progress', 'resolved', 'ignored')),
+  CONSTRAINT ai_insights_evidence_array_check CHECK (jsonb_typeof(evidence) = 'array'),
+  CONSTRAINT ai_insights_school_fingerprint_key UNIQUE (school_id, fingerprint)
+);
+
+CREATE INDEX idx_ai_insights_school_status_created
+  ON public.ai_insights (school_id, status, created_at DESC);
+CREATE INDEX idx_ai_insights_school_module_severity
+  ON public.ai_insights (school_id, module, severity, last_detected_at DESC);
+CREATE INDEX idx_ai_insights_open
+  ON public.ai_insights (school_id, last_detected_at DESC)
+  WHERE status IN ('new', 'seen', 'in_progress');
+
+CREATE FUNCTION public.set_ai_insights_updated_at()
+RETURNS trigger
+LANGUAGE plpgsql
+SET search_path = public
+AS $$
+BEGIN
+  NEW.updated_at := now();
+  RETURN NEW;
+END;
+$$;
+
+CREATE TRIGGER trg_ai_insights_updated_at
+BEFORE UPDATE ON public.ai_insights
+FOR EACH ROW EXECUTE FUNCTION public.set_ai_insights_updated_at();
+
+ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
+
+CREATE POLICY ai_insights_select_school_roles
+ON public.ai_insights FOR SELECT TO authenticated
+USING (
+  EXISTS (
+    SELECT 1 FROM public.escola_users eu
+    WHERE eu.escola_id = ai_insights.school_id
+      AND eu.user_id = auth.uid()
+      AND lower(eu.papel) = ANY (ARRAY[
+        'admin', 'admin_escola', 'staff_admin', 'direcao', 'diretoria',
+        'secretaria', 'financeiro', 'admin_financeiro', 'secretaria_financeiro'
+      ])
+  )
+);
+
+CREATE POLICY ai_insights_insert_school_roles
+ON public.ai_insights FOR INSERT TO authenticated
+WITH CHECK (
+  generated_by = auth.uid()
+  AND EXISTS (
+    SELECT 1 FROM public.escola_users eu
+    WHERE eu.escola_id = ai_insights.school_id
+      AND eu.user_id = auth.uid()
+      AND lower(eu.papel) = ANY (ARRAY[
+        'admin', 'admin_escola', 'staff_admin', 'direcao', 'diretoria',
+        'secretaria', 'financeiro', 'admin_financeiro', 'secretaria_financeiro'
+      ])
+  )
+);
+
+CREATE POLICY ai_insights_update_school_roles
+ON public.ai_insights FOR UPDATE TO authenticated
+USING (
+  EXISTS (
+    SELECT 1 FROM public.escola_users eu
+    WHERE eu.escola_id = ai_insights.school_id
+      AND eu.user_id = auth.uid()
+      AND lower(eu.papel) = ANY (ARRAY[
+        'admin', 'admin_escola', 'staff_admin', 'direcao', 'diretoria',
+        'secretaria', 'financeiro', 'admin_financeiro', 'secretaria_financeiro'
+      ])
+  )
+)
+WITH CHECK (
+  EXISTS (
+    SELECT 1 FROM public.escola_users eu
+    WHERE eu.escola_id = ai_insights.school_id
+      AND eu.user_id = auth.uid()
+      AND lower(eu.papel) = ANY (ARRAY[
+        'admin', 'admin_escola', 'staff_admin', 'direcao', 'diretoria',
+        'secretaria', 'financeiro', 'admin_financeiro', 'secretaria_financeiro'
+      ])
+  )
+);
+
+REVOKE ALL ON public.ai_insights FROM PUBLIC;
+GRANT SELECT, INSERT, UPDATE ON public.ai_insights TO authenticated;
+GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO service_role;
+
+COMMIT;
```

## Risco

Uma política RLS incorreta pode expor insights operacionais entre escolas ou impedir o cockpit de ler e atualizar estados; a proposta limita todas as operações autenticadas por vínculo em `escola_users` e não concede DELETE a usuários.

## Como aprovar

Commit com mensagem: `APPROVE: E1CD76F5-8886-4B66-A37C-DBF9D5253B1A`

## Como rejeitar

Commit com mensagem: `REJECT: E1CD76F5-8886-4B66-A37C-DBF9D5253B1A [motivo]`
