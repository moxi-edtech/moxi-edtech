CREATE TABLE IF NOT EXISTS public.professor_ponto_fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  mes date NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  fechado_por uuid,
  fechado_em timestamptz,
  reaberto_por uuid,
  reaberto_em timestamptz,
  motivo_reabertura text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escola_id, mes)
);

ALTER TABLE public.professor_ponto_fechamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS professor_ponto_fechamentos_select ON public.professor_ponto_fechamentos;
CREATE POLICY professor_ponto_fechamentos_select ON public.professor_ponto_fechamentos FOR SELECT TO authenticated USING (escola_id = public.current_tenant_escola_id());
DROP POLICY IF EXISTS professor_ponto_fechamentos_write ON public.professor_ponto_fechamentos;
CREATE POLICY professor_ponto_fechamentos_write ON public.professor_ponto_fechamentos FOR ALL TO authenticated USING (escola_id = public.current_tenant_escola_id()) WITH CHECK (escola_id = public.current_tenant_escola_id());
