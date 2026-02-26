# Aprovação necessária — Agent 3
run_id:    88445689-61AC-42D2-A51E-8F2D9C1C0C3D
timestamp: 2026-02-25T00:00:00Z

## Acção proposta
Adicionar nova tabela de pendências financeiras e políticas RLS para importação de alunos.

## Diff
```diff
*** Add File: supabase/migrations/20260225000000_importacao_pendencias_financeiro.sql
+CREATE TABLE IF NOT EXISTS public.import_financeiro_pendencias (
+  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
+  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
+  escola_id uuid NOT NULL,
+  import_id uuid NOT NULL REFERENCES public.import_migrations(id) ON DELETE CASCADE,
+  aluno_id uuid,
+  matricula_id uuid,
+  turma_id uuid,
+  motivo text NOT NULL,
+  mensagem text NOT NULL,
+  detalhes jsonb,
+  resolvido boolean DEFAULT false,
+  resolved_at timestamptz,
+  resolved_by uuid
+);
+
+CREATE INDEX IF NOT EXISTS import_financeiro_pendencias_import_id_idx
+  ON public.import_financeiro_pendencias (import_id);
+
+CREATE INDEX IF NOT EXISTS import_financeiro_pendencias_escola_id_idx
+  ON public.import_financeiro_pendencias (escola_id);
+
+CREATE INDEX IF NOT EXISTS import_financeiro_pendencias_matricula_id_idx
+  ON public.import_financeiro_pendencias (matricula_id);
+
+ALTER TABLE public.import_financeiro_pendencias ENABLE ROW LEVEL SECURITY;
+
+DROP POLICY IF EXISTS import_financeiro_pendencias_service_full ON public.import_financeiro_pendencias;
+CREATE POLICY import_financeiro_pendencias_service_full
+  ON public.import_financeiro_pendencias
+  FOR ALL
+  TO service_role
+  USING (true)
+  WITH CHECK (true);
+
+DROP POLICY IF EXISTS import_financeiro_pendencias_staff_read ON public.import_financeiro_pendencias;
+CREATE POLICY import_financeiro_pendencias_staff_read
+  ON public.import_financeiro_pendencias
+  FOR SELECT
+  TO authenticated
+  USING (
+    EXISTS (
+      SELECT 1
+      FROM public.import_migrations m
+      WHERE m.id = import_financeiro_pendencias.import_id
+        AND public.is_staff_escola(m.escola_id)
+    )
+  );
+
+DROP POLICY IF EXISTS import_financeiro_pendencias_staff_write ON public.import_financeiro_pendencias;
+CREATE POLICY import_financeiro_pendencias_staff_write
+  ON public.import_financeiro_pendencias
+  FOR INSERT
+  TO authenticated
+  WITH CHECK (
+    EXISTS (
+      SELECT 1
+      FROM public.import_migrations m
+      WHERE m.id = import_financeiro_pendencias.import_id
+        AND public.is_staff_escola(m.escola_id)
+    )
+  );
+
+GRANT ALL ON TABLE public.import_financeiro_pendencias TO anon, authenticated, service_role;
```

## Risco
Políticas RLS incorretas podem bloquear acesso legítimo ou expor dados entre escolas.

## Como aprovar
Commit com mensagem: `APPROVE: 88445689-61AC-42D2-A51E-8F2D9C1C0C3D`

## Como rejeitar
Commit com mensagem: `REJECT: 88445689-61AC-42D2-A51E-8F2D9C1C0C3D [motivo]`
