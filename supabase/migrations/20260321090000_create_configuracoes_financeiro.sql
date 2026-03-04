CREATE TABLE IF NOT EXISTS public.configuracoes_financeiro (
  escola_id uuid PRIMARY KEY REFERENCES public.escolas (id) ON DELETE CASCADE,
  dia_vencimento_padrao integer NOT NULL DEFAULT 10,
  multa_atraso_percent numeric(5,2) NOT NULL DEFAULT 10,
  juros_diarios_percent numeric(5,2) NOT NULL DEFAULT 0.5,
  bloquear_inadimplentes boolean NOT NULL DEFAULT false,
  moeda text NOT NULL DEFAULT 'AOA',
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT configuracoes_financeiro_dia_vencimento_chk CHECK (dia_vencimento_padrao BETWEEN 1 AND 31),
  CONSTRAINT configuracoes_financeiro_multa_chk CHECK (multa_atraso_percent BETWEEN 0 AND 100),
  CONSTRAINT configuracoes_financeiro_juros_chk CHECK (juros_diarios_percent BETWEEN 0 AND 100)
);

CREATE TRIGGER trg_bu_config_financeiro_updated_at
  BEFORE UPDATE ON public.configuracoes_financeiro
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.configuracoes_financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_financeiro_unificado_v3" ON public.configuracoes_financeiro
  TO authenticated
  USING (
    escola_id IN (
      SELECT p.escola_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid() AS uid)
    )
  )
  WITH CHECK (
    escola_id IN (
      SELECT p.escola_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid() AS uid)
    )
  );

GRANT ALL ON TABLE public.configuracoes_financeiro TO anon;
GRANT ALL ON TABLE public.configuracoes_financeiro TO authenticated;
GRANT ALL ON TABLE public.configuracoes_financeiro TO service_role;
